import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps
{
    content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps)
{
    return (
        <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary hover:prose-a:underline">
            <ReactMarkdown>{content}</ReactMarkdown>
        </div>
    );
}
