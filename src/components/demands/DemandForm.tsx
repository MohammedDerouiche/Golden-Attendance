
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { createDemand, getDemandCategories, uploadDemandImage, updateDemand, createCategory, deleteCategory } from '@/lib/supabase/api';
import type { CustomerDemandInsert, DemandCategory } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Upload, Trash2, Image as ImagePlus, PlusCircle } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';

const demandSchema = z.object({
  customer_name: z.string().min(2, { message: 'Customer name is required.' }),
  customer_phone: z.string().optional(),
  product_description: z.string().min(10, { message: 'Please provide a detailed description.' }),
  desired_date: z.date().optional().nullable(),
  category_id: z.string().optional().nullable(),
  image: z.instanceof(File).optional().nullable(),
});

type DemandFormValues = z.infer<typeof demandSchema>;

interface DemandFormProps {
  onFinished: () => void;
}

const AddCategoryDialog = ({ onCategoryAdded }: { onCategoryAdded: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleCreate = async () => {
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Category name cannot be empty.' });
            return;
        }
        setIsSaving(true);
        try {
            await createCategory(name);
            toast({ title: 'Success', description: 'Category created.' });
            onCategoryAdded();
            setIsOpen(false);
            setName('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon"><PlusCircle className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Category</DialogTitle>
                    <DialogDescription>Create a new category for customer demands.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="category-name">Category Name</Label>
                    <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function DemandForm({ onFinished }: DemandFormProps) {
  const { toast } = useToast();
  const { selectedUser } = useSelectedUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<DemandCategory | null>(null);

  const { data: categories, mutate: mutateCategories } = useSWR('demand_categories', getDemandCategories);
  
  const form = useForm<DemandFormValues>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      product_description: '',
      desired_date: null,
      category_id: '',
      image: null,
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('image', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    form.setValue('image', null);
    setImagePreview(null);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteCategory(categoryToDelete.id);
      toast({ title: 'Category Deleted' });
      form.setValue('category_id', '');
      mutateCategories();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setCategoryToDelete(null);
    }
  };

  const onSubmit = async (values: DemandFormValues) => {
    if (!selectedUser) {
        toast({ variant: 'destructive', title: 'You must be logged in to create a demand.' });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const initialDemandData: CustomerDemandInsert = {
            customer_name: values.customer_name,
            customer_phone: values.customer_phone,
            product_description: values.product_description,
            desired_date: values.desired_date?.toISOString(),
            category_id: values.category_id || null,
            created_by: selectedUser.id,
        };
        const newDemand = await createDemand(initialDemandData);

        let imageUrl: string | undefined = undefined;
        if (values.image) {
            imageUrl = await uploadDemandImage(values.image, newDemand.id);
            await updateDemand(newDemand.id, { image_url: imageUrl });
        }
        
        toast({ title: 'Demand Created', description: 'The new customer demand has been saved.' });
        onFinished();

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'An error occurred',
            description: error.message,
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const selectedCategoryId = form.watch('category_id');

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="555-123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <FormField
          control={form.control}
          name="product_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the product the customer is looking for..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <div className="flex items-center gap-2">
                             <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {categories?.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <AddCategoryDialog onCategoryAdded={() => mutateCategories()} />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={!selectedCategoryId}
                                onClick={() => {
                                    const cat = categories?.find(c => c.id === selectedCategoryId);
                                    if (cat) setCategoryToDelete(cat);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                         <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
              control={form.control}
              name="desired_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Needed By (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <div className="space-y-2">
            <FormLabel>Image (Optional)</FormLabel>
            {imagePreview ? (
                <div className="relative w-full aspect-square max-w-sm mx-auto">
                     <Image src={imagePreview} alt="Image preview" layout="fill" className="rounded-md object-cover" />
                     <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={removeImage}>
                         <Trash2 className="h-3 w-3" />
                     </Button>
                </div>
            ) : (
                <FormControl>
                    <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <ImagePlus className="w-10 h-10 mb-3 text-muted-foreground" />
                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                        </div>
                        <Input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                </FormControl>
            )}
        </div>


        <div className="pt-6 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Demand'}
            </Button>
        </div>
      </form>
    </Form>

     <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the category "{categoryToDelete?.name}". This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive hover:bg-destructive/90">
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
