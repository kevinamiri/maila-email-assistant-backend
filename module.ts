import * as AWS from 'aws-sdk';
import * as dotenv from 'dotenv';
import { ParsedMail, simpleParser } from 'mailparser';
import { Config, Data, overridesTypes } from './types';
import { AI_PROMPT, Client, HUMAN_PROMPT } from "@anthropic-ai/sdk";
import { inferMessage } from './infer-message';
import { htmlContent } from './context';


dotenv.config();

AWS.config.update({
    region: 'eu-west-1'
});
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
    throw new Error("The ANTHROPIC_API_KEY environment variable must be set");
}




const AnthropicClient = new Client(apiKey);

const createCompletion = async (prompt: string) => {
    return AnthropicClient
        .complete({
            prompt: `${HUMAN_PROMPT} ${prompt}${AI_PROMPT}`,
            stop_sequences: [HUMAN_PROMPT],
            max_tokens_to_sample: 50000,
            temperature: 0.74,
            model: "claude-v1-100k",
        })
        .then((res) => {
            return res?.completion
        })
        .catch((error) => {
            console.error(error);
        });


}


export const parseEvent = (data: Data): Promise<Data> => {
    if (!data.event ||
        !data.event.hasOwnProperty('Records') ||
        data.event.Records.length !== 1 ||
        !data.event.Records[0].hasOwnProperty('eventSource') ||
        data.event.Records[0].eventSource !== 'aws:ses' ||
        data.event.Records[0].eventVersion !== '1.0') {
        data.log({
            message: "parseEvent() received invalid SES message:",
            level: "error", event: JSON.stringify(data.event)
        });
        return Promise.reject(new Error('Error: Received invalid SES message.'));
    }

    data.email = data.event.Records[0].ses.mail;
    data.recipients = data.event.Records[0].ses.receipt.recipients;
    return Promise.resolve(data);
};

export const transformRecipients = (data: Data): Promise<Data> => {
    let newRecipients: string[] = [];
    data.originalRecipients = data.recipients;
    data.recipients?.forEach((origEmail) => {
        const origEmailKey = origEmail.toLowerCase();
        if (data.config.forwardMapping.hasOwnProperty(origEmailKey)) {
            newRecipients = newRecipients.concat(
                data.config.forwardMapping[origEmailKey]);
            data.originalRecipient = origEmail;
        } else {
            let origEmailDomain: string | undefined;
            let origEmailUser: string | undefined;
            const pos = origEmailKey.lastIndexOf("@");
            if (pos === -1) {
                origEmailUser = origEmailKey;
            } else {
                origEmailDomain = origEmailKey.slice(pos);
                origEmailUser = origEmailKey.slice(0, pos);
            }
            if (origEmailDomain &&
                data.config.forwardMapping.hasOwnProperty(origEmailDomain)) {
                newRecipients = newRecipients.concat(
                    data.config.forwardMapping[origEmailDomain]);
                data.originalRecipient = origEmail;
            } else if (origEmailUser &&
                data.config.forwardMapping.hasOwnProperty(origEmailUser)) {
                newRecipients = newRecipients.concat(
                    data.config.forwardMapping[origEmailUser]);
                data.originalRecipient = origEmail;
            }
        }
    });

    if (!newRecipients.length) {
        data.log({
            message: "Finishing process. No new recipients found for " +
                "original destinations: " + data.originalRecipients?.join(", "),
            level: "info"
        });
        return data.callback();
    }
    data.recipients = newRecipients;
    return Promise.resolve(data);
};


/**
 * Logs an informational message.
 * @param {Data} data - The data object containing necessary parameters and methods.
 * @param {string} message - The message to log.
 */
const logInfo = (data: Data, message: string) => {
    data.log({
        level: "info",
        message: message
    });
};


/**
 * Creates the parameters for the S3 copy operation.
 * @param {Data} data - The data object containing necessary parameters and methods.
 * @returns {Object} - The parameters for the S3 copy operation.
 */
const createCopyParams = (data: Data) => ({
    Bucket: data.config.emailBucket,
    CopySource: `${data.config.emailBucket}/${data.config.emailKeyPrefix}${data.email?.messageId}`,
    Key: `${data.config.emailKeyPrefix}${data.email?.messageId}`,
    ACL: 'private',
    ContentType: 'text/plain',
    StorageClass: 'STANDARD'
});

/**
 * Creates the parameters for the S3 get operation.
 * @param {Data} data - The data object containing necessary parameters and methods.
 * @returns {Object} - The parameters for the S3 get operation.
 */
const createGetObjectParams = (data: Data) => ({
    Bucket: data.config.emailBucket,
    Key: `${data.config.emailKeyPrefix}${data.email?.messageId}`
});

/**
 * Fetches an email message from an S3 bucket.
 * @param {Data} data - The data object containing necessary parameters and methods.
 * @returns {Promise<Data>} - Returns a promise that resolves with the updated data object.
 */
export const fetchMessage = async (data: Data): Promise<Data> => {
    try {
        logInfo(data, `Fetching email at s3://${data.config.emailBucket}/${data.config.emailKeyPrefix}${data.email?.messageId}`);

        const copyParams = createCopyParams(data);
        const getObjectParams = createGetObjectParams(data);

        await data.s3.copyObject(copyParams).promise();
        const result = await data.s3.getObject(getObjectParams).promise();

        // Convert the result body to a string and assign it to emailData
        data.emailData = result.Body?.toString();
        const content = result.Body?.toString() as string;

        // Parse the email content
        const parsed = await simpleParser(content) as ParsedMail;

        // Extract the text and HTML content
        const textContent = parsed.text;
        const htmlContent = parsed.html;
        data.text = textContent;
        htmlContent ? data.html = htmlContent : null;

        // console.log('textContent', textContent);
        // console.log('\n\n\n\n\n\nhtmlContent,\n\n', htmlContent);

        console.log(`data.emailData`, data.emailData);

        // Replace the emailData with the extracted text or HTML content
        // depending on your needs
        // data.emailData = textContent; // or htmlContent;
        // data.emailData = data.emailData?.replace(/(\r\n|\n|\r)/gm, "<br>");

        return data;

    } catch (error) {
        console.log(data, error);
        throw new Error("Error: Failed to fetch message.");
    }
};


/**
 * ================================================================================
 * A Lambda function that will receive emails from SES and forward them to the
 * ================================================================================
 */

/**
 * This function processes an email message, modifying the header fields according to the provided configuration.
 * It extracts the header and body of the email, adds a 'Reply-To' field if it doesn't exist, modifies the 'From', 'Subject', and 'To' fields,
 * and removes 'Return-Path', 'Sender', 'Message-ID', and 'DKIM-Signature' fields. The modified email data is then returned.
 *
 * @param {Data} data - The data object containing the email data and configuration.
 * @returns {Promise<Data>} - Returns a Promise that resolves with the modified data object.
 */
export const processMessage = async (data: Data): Promise<Data> => {
    try {
        // Validate configuration
        if (!data.config) {
            data.log({ level: "error", message: "Invalid configuration." });
            return data;
        }

        // Extract the header and body of the email
        const match = data.emailData?.match(/^((?:.+\r?\n)*)(\r?\n(?:.*\s+)*)/m);
        let header = match?.[1] || data.emailData as string;
        const body = match?.[2] || '';

        // Check if the email is forwarded
        const forwardedMatch = body?.match(/---------- Forwarded message ---------\r?\nFrom: .* <(.*)>\r?\nDate: .*\r?\nSubject: .*\r?\nTo: <.*>/) as RegExpMatchArray;
        const forwardedMessageChunk = forwardedMatch?.[0]
        // Extract the "ForwardedTo", "ForwardedSubject", "ForwardedDate", and "ForwardedFrom" fields from forwardedMessageChunk
        if (forwardedMessageChunk) {
            const forwardedFromMatch = forwardedMessageChunk.match(/From: .* <(.*)>/);
            const forwardedDateMatch = forwardedMessageChunk.match(/Date: (.*)/);
            const forwardedSubjectMatch = forwardedMessageChunk.match(/Subject: (.*)/);
            const forwardedToMatch = forwardedMessageChunk.match(/To: <(.*)>/);

            const forwardedFrom = forwardedFromMatch ? forwardedFromMatch[1] : forwardedMatch?.[1] || '';
            const forwardedDate = forwardedDateMatch ? forwardedDateMatch[1] : '';
            const forwardedSubject = forwardedSubjectMatch ? forwardedSubjectMatch[1] : '';
            const forwardedTo = forwardedToMatch ? forwardedToMatch[1] : '';

            console.log('forwardedFrom', forwardedFrom);
            console.log('forwardedDate', forwardedDate);
            console.log('forwardedSubject', forwardedSubject);
            console.log('forwardedTo', forwardedTo);

            // Add these fields to the data object
            data.config.forwardedFrom = forwardedFrom;
            data.config.forwardedDate = forwardedDate;
            data.config.forwardedSubject = forwardedSubject;
            data.config.forwardedTo = forwardedTo;
        }


        // Add 'Reply-To' field if it doesn't exist
        if (!/^Reply-To: /mi.test(header)) {
            const fromMatch = header?.match(/^From: (.*(?:\r?\n\s+.*)*\r?\n)/m);
            const from = fromMatch?.[1] || '';
            if (from) {
                header += 'Forwarded-From: ' + from;
                header += 'Reply-To: ' + from;
                data.log({ level: "info", message: `Added Reply-To address of: ${from}` });
            } else {
                data.log({ level: "info", message: "Reply-To address not added because From address was not properly extracted." });
            }
        }

        // Modify 'From' field
        header = header?.replace(/^From: (.*(?:\r?\n\s+.*)*)/mg, (match, from) => {
            const fromText = data.config.fromEmail
                ? `From: ${from.replace(/<(.*)>/, '').trim()} <${data.config.fromEmail}>`
                : `From: ${from.replace('<', 'at ').replace('>', '')} <${data.originalRecipient}>`;
            return fromText;
        });

        // Modify 'Subject' field
        if (data.config.subjectPrefix) {
            header = header?.replace(/^Subject: (.*)/mg, (match, subject) => `Subject: ${data.config.subjectPrefix}${subject}`);
        }

        // Modify 'To' field
        if (data.config.toEmail) {
            header = header?.replace(/^To: (.*)/mg, () => `To: ${data.config.toEmail}`);
        }

        // Add 'CC' and 'BCC' fields
        if (data.config.ccEmail) {
            header += `CC: ${data.config.ccEmail}\r\n`;
        }
        if (data.config.bccEmail) {
            header += `BCC: ${data.config.bccEmail}\r\n`;
        }

        // Remove 'Return-Path', 'Sender', 'Message-ID', and 'DKIM-Signature' fields
        header = header?.replace(/^Return-Path: (.*)\r?\n/mg, '')
            .replace(/^Sender: (.*)\r?\n/mg, '')
            .replace(/^Message-ID: (.*)\r?\n/mig, '')
            .replace(/^DKIM-Signature: .*\r?\n(\s+.*\r?\n)*/mg, '');
        // console.log(data)
        // Combine the modified header and the body
        data.emailData = header + body;

        return data;
    } catch (error) {
        console.log(data, error);
        return data;
    }
};


export const sendMessage = async (data: Data): Promise<Data> => {
    // Ensure that data.emailData is not undefined before passing it to params
    if (!data.emailData) {
        throw new Error('Error: Email data is undefined.');
    }

    const params = {
        Destinations: data.recipients,
        Source: data.originalRecipient,
        RawMessage: {
            Data: data.emailData
        }
    };
    data.log({
        level: "info", message: "sendMessage: Sending email via SES. " +
            "Source: " + data.originalRecipients?.join(", ") +
            ". Destinations: " + data.recipients?.join(", ") + "."
    });
    try {
        const result = await data.ses.sendRawEmail(params).promise();
        data.log({
            level: "info", message: "sendRawEmail() successful.",
            result: result
        });
        return data;
    } catch (err) {
        data.log({
            level: "error", message: "sendRawEmail() returned error.", error: err,
        });
        throw new Error('Error: Email sending failed.');
    }
};


export const sendMessageSimple = async (data: Data): Promise<Data> => {
    try {
        const inferOutput = await inferMessage(`${data.text}`);
        // company email 
        const company__maila = data.originalRecipients
        const company_email = data.config.forwardedTo ? data.config.forwardedTo : data.email.source
        // customer email
        const customer_email = data.config.forwardedFrom ? data.config.forwardedFrom : data.email.destination
        const subject = data.config.forwardedSubject ? data.config.forwardedSubject : data.email.commonHeaders.subject
        const email_from_config = data.config.fromEmail
        // commonHeaders
        const commonHeaders = data.email.commonHeaders.subject
        // headers
        const headers = data.email.headers
        console.log("company__maila", company__maila, "company_email", company_email, "customer_email", customer_email, "subject", subject, "email_from_config", email_from_config, "commonHeaders", commonHeaders, "headers", headers)

        const generatedOuptut = {
            title: subject,
            subject: subject,
            content: inferOutput,
            signature: subject,
            footer: ""
        }
        const params = {
            Destination: {
                ToAddresses: [
                    company_email,
                    customer_email
                ],
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: htmlContent(generatedOuptut),
                    },
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject as string,
                },
            },
            Source: company__maila[0] as string,
        }

        const notFW = {
            Destination: {
                ToAddresses: [
                    company_email
                ],
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: htmlContent(generatedOuptut),
                    },
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject as string,
                },
            },
            Source: company__maila[0] as string,
        }
        const parameters = data.config.forwardedSubject ? params : notFW

        const res = await data.ses.sendEmail(parameters).promise();
        console.log(res);
        return data;
    } catch (err) {
        data.log({
            level: "error", message: "sendTemplatedEmail() returned error.", error: err,
        });
        throw new Error('Error: Email sending failed.');
    }
};



function series(promises: ((data: Data) => Promise<Data>)[], initValue: Data): Promise<Data> {
    return promises.reduce(function (chain, promise) {
        if (typeof promise !== 'function') {
            return Promise.reject(new Error("Error: Invalid promise item: " +
                promise));
        }
        return chain.then(promise);
    }, Promise.resolve(initValue));
}


export const handler_ = async (event: any, context: any, callback: any, overrides?: overridesTypes) => {
    const defaultConfig: Config = {
        subjectPrefix: "",
        toEmail: "",
        region: "eu-west-1",
        fromEmail: "noreply@bot.maila.ai",
        emailBucket: "maila-ai",
        emailKeyPrefix: "emails/",
        forwardMapping: {
            "@bot.maila.ai": [
                "kevin@maila.ai"
            ],
            "@auto.maila.ai": [
                "kevin@maila.ai"
            ]
        }
    };

    const steps = overrides && overrides.steps ? overrides.steps :
        [
            parseEvent,
            transformRecipients,
            fetchMessage,
            processMessage,
            sendMessage,
            sendMessageSimple
        ];
    const data: Data = {
        event: event,
        callback: callback,
        context: context,
        config: overrides && overrides.config ? overrides.config : defaultConfig,
        log: overrides && overrides.log ? overrides.log : console.log,
        ses: overrides && overrides.ses ? overrides.ses : new AWS.SES({ region: 'eu-west-1' }),
        s3: overrides && overrides.s3 ?
            overrides.s3 : new AWS.S3({ region: 'eu-west-1', signatureVersion: 'v4' })
    };
    series(steps, data)
        .then(function (data) {
            data.log({ level: "info", message: "Process finished successfully." });
            return data.callback();
        })
        .catch(function (err) {
            data.log({
                level: "error", message: "Step returned error: " + err.message,
                error: err, stack: err.stack
            });
            return data.callback(new Error("Error: Step returned error."));
        });
};


