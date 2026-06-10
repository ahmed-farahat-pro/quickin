'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/supabase'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit, Trash2, FileText, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

type CustomPage = Database['public']['Tables']['custom_pages']['Row']

interface PagesManagerProps {
  initialPages: CustomPage[]
}

export function PagesManager({ initialPages }: PagesManagerProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  
  const supabase = createClient()

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this page?')) return

    setIsDeleting(id)
    try {
      const { error } = await supabase
        .from('custom_pages')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Page deleted successfully')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete page')
    } finally {
      setIsDeleting(null)
    }
  }

  const getTitle = (titleObj: any) => {
    if (!titleObj) return 'Untitled'
    return titleObj.en || titleObj.ar || 'Untitled'
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Custom Pages</CardTitle>
          <CardDescription>Create and manage custom pages like Terms, Privacy, etc.</CardDescription>
        </div>
        <Link href="/admin/settings/site/pages/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Page
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {initialPages.length === 0 ? (
          <div className="text-center p-12 border border-dashed rounded-lg bg-muted/30">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-lg font-medium">No pages created yet</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Create your first custom page to add content for your users.
            </p>
            <Link href="/admin/settings/site/pages/new">
              <Button variant="outline">Create Page</Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{getTitle(page.title)}</TableCell>
                    <TableCell>
                      <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                        /{page.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      {page.is_published ? (
                        <Badge variant="default" className="bg-green-600">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {page.updated_at ? format(new Date(page.updated_at), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {page.is_published && (
                          <Link href={`/${page.slug}`} target="_blank">
                            <Button variant="ghost" size="icon" title="View Page">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Link href={`/admin/settings/site/pages/${page.id}`}>
                          <Button variant="ghost" size="icon" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(page.id)}
                          disabled={isDeleting === page.id}
                          title="Delete"
                        >
                          {isDeleting === page.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
