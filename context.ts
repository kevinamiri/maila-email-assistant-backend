


export const searchPromptPrefix = `Here is a possible search queries to find a solution to the issue described in the email.

Search query:
    -`

export const htmlContent = (params: {
    title?: string | undefined | null | void,
    content?: string | undefined | null | void,
    signature?: string | undefined | null | void,
    footer?: string | undefined | null | void,
}): string => {

    // convert text to html
    const textToHtml = (text: string): string => {
        return text.replace(/\n/g, '<br>');
    }
    const content_html = textToHtml(params.content || '')

    return `
    <!DOCTYPE html>
    <html>
    
    <head>
        <meta charset="utf-8">
        <title>${params.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
        body {
            font-family: Arial, sans-serif, Tahoma, Verdana, Helvetica;
            margin: 0;
            padding: 0;
        }
        
        .container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #ddd;
        }
        
        .header {
            background: #428bca;
            padding: 20px;
            color: #fff;
        }
        
        .content {
            padding: 20px;
            background: #fff;
        }
        
        .footer {
            background: #f8f8f8;
            padding: 20px;
            text-align: center;
        }
        
        img {
            max-width: 100%;
            height: auto;
        }
        
        a {
            color: #428bca;
            text-decoration: none;
        }
        
        @media screen and (max-width: 600px) {
            .container {
                width: 100%;
            }
        }
    </style>
    </head>
    
    <body>
        <div class="container">
            <div class="content">
                <p>${content_html}</p>
            </div>
            <div class="footer">
                <qoute>${params.footer}</qoute>
                <p> AI-generated Email: it's important to note that while the AI strives for accuracy, it may not always fully understand or appropriately respond to certain contexts or nuances. If you have any concerns about the content of this email, please feel free to reach out by kevin@maila.ai</div>
        </div>
    </body>
    
    </html>
    `;
}