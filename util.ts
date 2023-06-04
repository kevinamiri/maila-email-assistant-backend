import * as fs from 'fs';
// Function to save content to a file
export const saveToFile = (filename: string, content: string) => {
    fs.appendFile(filename, content, (err: any) => {
        if (err) throw err;
        console.log('The file has been saved!');
    });
}
