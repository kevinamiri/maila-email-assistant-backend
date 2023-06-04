

export interface Config {
    region?: string;
    subjectPrefix?: string;
    fromEmail: string;
    emailBucket: string;
    toEmail?: string;
    bccEmail?: string;
    ccEmail?: string;
    textContent?: string;
    emailKeyPrefix: string;
    forwardMapping: {
        [key: string]: string[];
    };
    forwardedFrom?: string;
    forwardedTo?: string;
    forwardedSubject?: string;
    forwardedDate?: string;


}

export interface Data {
    event?: any;
    callback?: any;
    context?: any;
    config: Config;
    log: Console['log'];
    ses: AWS.SES;
    s3: AWS.S3;
    email?: any;
    recipients?: string[];
    originalRecipients?: string[];
    originalRecipient?: string;
    emailData?: string;
    text?: string;
    html?: string;
}

export type overridesTypes = {
    steps?: ((data: Data) => Promise<Data>)[];
    config: Config;
    log?: any;
    ses?: AWS.SES;
    s3?: AWS.S3;

}