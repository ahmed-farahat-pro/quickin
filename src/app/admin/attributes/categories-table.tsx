'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getCategoriesColumns, AttributeCategory } from './categories-columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteCategory } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { CategoryFormDialog } from './category-form-dialog'

interface CategoriesTableProps {
  categories: AttributeCategory[]
}

export function CategoriesTable({ categories }: CategoriesTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState<AttributeCategory | null>(null)
  
  const [formDialogOpen, setFormDialogOpen] = React.useState(false)
  const [categoryToEdit, setCategoryToEdit] = React.useState<AttributeCategory | null>(null)

  const handleEditClick = (category: AttributeCategory) => {
    setCategoryToEdit(category)
    setFormDialogOpen(true)
  }

  const handleDeleteClick = (category: AttributeCategory) => {
    setSelectedCategory(category)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedCategory) return
    const result = await deleteCategory(selectedCategory.id)
    if (result.error) {
      throw new Error(result.error)
    }
    router.refresh()
  }

  const columns = React.useMemo(() => getCategoriesColumns({ 
    onEdit: handleEditClick,
    onDelete: handleDeleteClick
  }), [])

  return (
    <>
      <DataTable 
        columns={columns} 
        data={categories}
        searchKey="label"
        searchPlaceholder="Filter categories by label..."
      />
      
      {selectedCategory && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Category"
          itemName={selectedCategory.label}
          description={`Are you sure you want to delete "${selectedCategory.label}"? If there are attributes assigned to it, the deletion will fail.`}
          onConfirm={handleConfirmDelete}
        />
      )}

      {categoryToEdit && (
        <CategoryFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          initialData={categoryToEdit}
        />
      )}
    </>
  )
}
