// import LambdaForwarder from module.js file
import { handler_ } from './module';

import {
    Context, Callback
} from "aws-lambda";

interface Overrides {
    config: {
        region: string;
        fromEmail: string;
        emailBucket: string;
        emailKeyPrefix: string;
        forwardMapping: Record<string, string[]>;
    };
}



const handler = (event: any, context: Context, callback: Callback) => {
    console.log("event", JSON.stringify(event));
    const overrides: Overrides = {
        config: {
            region: "eu-west-1",
            fromEmail: "noreply@bot.maila.ai",
            emailBucket: "maila-ai",
            emailKeyPrefix: "emails/",
            forwardMapping: {
                "@bot.maila.ai": [
                    "kevin@maila.ai"
                ],
                "@auto.maila.ai": [
                    "service@maila.ai"
                ]
            }
        }
    };
    handler_(event, context, callback, overrides);
};


export { handler };