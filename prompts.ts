export const initialPrompt = (prompt: any) => {
    return `Outline all steps need to be taken to address the given input:


${prompt}


In order to provide assist to the above input, the following steps need to be taken:

`}

export const outlineSolution = (problemStatement: any) => {
    return `Outline all steps need to be taken to find a search query to the given input:


${problemStatement}


In order to provide assist to the above input, the following steps need to be taken:

1. Identify which search query to use to search for the given input.
2. Brainstorm all possible solutions to the given input and Select the best solution to the given input.
3. Identify which search query to use to search for the given input
`}

export const chainContexts = (section: string, subject_matter: string) => {
    console.log(section)

    return `Use the following resource sections to respond to the given email.

<email>
${subject_matter}
<email>



<resource>
${section}
</resource>


` as string;
}

export const chainSearch = (prompt: string) => {
    return `Using advanced search operators, provide a search query to address the given email:

<email>
${prompt}
</email>

`}



