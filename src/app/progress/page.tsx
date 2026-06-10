import fs from 'fs';
import path from 'path';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default async function ProgressPage()
{
    const progressPath = path.join(process.cwd(), 'docs', 'progress-tracker.md');
    const strategyPath = path.join(process.cwd(), 'docs', 'mobile_strategy_comparison.md');

    // Ensure files determine if files exist, if not return a friendly message or empty string
    let progressContent = '';
    let strategyContent = '';

    try {
        progressContent = fs.readFileSync(progressPath, 'utf-8');
    } catch (_) { // usage of _ as ignored variable
        progressContent = '# Progress Tracker Not Found\n\nThe progress tracker file could not be found.';
    }

    try {
        strategyContent = fs.readFileSync(strategyPath, 'utf-8');
    } catch (_) { // usage of _ as ignored variable
        strategyContent = '# Strategy Document Not Found\n\nThe strategy comparison file could not be found.';
    }

    return (
        <div className="container mx-auto py-10 space-y-8 px-4 md:px-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Project Documentation</h1>
            <p className="text-muted-foreground">Track project progress and review strategy documents.</p>

            <Tabs defaultValue="progress" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="progress">Progress Tracker</TabsTrigger>
                    <TabsTrigger value="mobile">Mobile Strategy</TabsTrigger>
                </TabsList>
                <TabsContent value="progress" className="mt-6">
                    <div className="bg-card rounded-xl border shadow-sm p-6 md:p-8">
                        <MarkdownRenderer content={progressContent} />
                    </div>
                </TabsContent>
                <TabsContent value="mobile" className="mt-6">
                    <div className="bg-card rounded-xl border shadow-sm p-6 md:p-8">
                        <MarkdownRenderer content={strategyContent} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
