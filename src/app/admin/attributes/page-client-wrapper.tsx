'use client'

import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AttributesTable } from './attributes-table'
import { CategoriesTable } from './categories-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { CategoryFormDialog } from './category-form-dialog'

export function PageClientWrapper({ attributes, categories }: { attributes: any[], categories: any[] }) {
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false)

  return (
    <Tabs defaultValue="attributes" className="space-y-4">
      <div className="flex justify-between items-center">
        <TabsList>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Category
          </Button>
          <Button asChild>
            <Link href="/admin/attributes/new">
              <Plus className="h-4 w-4 mr-2" />
              New Attribute
            </Link>
          </Button>
        </div>
      </div>

      <TabsContent value="attributes">
        <Card>
          <CardHeader>
            <CardTitle>Attributes & Amenities</CardTitle>
            <CardDescription>
              Manage the features, rules, and amenities available for listings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttributesTable attributes={attributes} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="categories">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Group attributes together in the host and guest UIs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoriesTable categories={categories} />
          </CardContent>
        </Card>
      </TabsContent>

      <CategoryFormDialog 
        open={categoryDialogOpen} 
        onOpenChange={setCategoryDialogOpen} 
      />
    </Tabs>
  )
}
