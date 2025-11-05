

'use client';

import { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { createTask, updateTask, getTaskGroups, createTaskGroup, uploadTaskImage } from '@/lib/supabase/api';
import type { Task, TaskInsert, TaskUpdate } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Image as ImageIcon, Camera, Trash2, Upload, Loader2, SwitchCamera } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { Switch } from '../ui/switch';

const taskSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'undone']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigned_to: z.array(z.string()).optional(),
  due_date: z.date().optional().nullable(),
  group_id: z.string().optional().nullable(),
  recurrence_type: z.enum(['none', 'daily', 'weekly', 'monthly', 'custom_days']),
  recurrence_interval: z.coerce.number().positive().optional().nullable(),
  allow_delay: z.boolean().optional(),
  image_urls: z.array(z.string()).optional().nullable(),
}).refine(data => {
    if (data.recurrence_type === 'custom_days') {
        return data.recurrence_interval != null && data.recurrence_interval > 0;
    }
    return true;
}, {
    message: "Interval is required for custom recurrence.",
    path: ["recurrence_interval"],
});


type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  task: Task | null;
  onFinished: () => void;
}

function CreateGroupDialog({ onGroupCreated }: { onGroupCreated: (newGroup: any) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleCreate = async () => {
        if (!groupName.trim()) {
            toast({ variant: 'destructive', title: 'Group name cannot be empty.' });
            return;
        }
        setIsSaving(true);
        try {
            const newGroup = await createTaskGroup(groupName);
            toast({ title: 'Group Created', description: `Successfully created group "${newGroup.name}".`});
            onGroupCreated(newGroup);
            setIsOpen(false);
            setGroupName('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error creating group', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Task Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input 
                        id="group-name" 
                        value={groupName} 
                        onChange={(e) => setGroupName(e.target.value)} 
                        placeholder="e.g., Marketing Campaign"
                    />
                </div>
                <div className="flex justify-end gap-2">
                     <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                     <Button onClick={handleCreate} disabled={isSaving}>
                        {isSaving ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default function TaskForm({ task, onFinished }: TaskFormProps) {
  const { toast } = useToast();
  const { users, selectedUser } = useSelectedUser();
  const { data: taskGroups, mutate: mutateGroups } = useSWR('task_groups', getTaskGroups);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const [showCamera, setShowCamera] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>();
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        assigned_to: [],
        due_date: null,
        group_id: 'no-group',
        recurrence_type: 'none',
        recurrence_interval: undefined,
        allow_delay: true,
        image_urls: [],
    },
  });
  
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to ? [task.assigned_to.id] : [],
        due_date: task.due_date ? new Date(task.due_date) : null,
        group_id: task.group_id ?? 'no-group',
        recurrence_type: task.recurrence_type || 'none',
        recurrence_interval: task.recurrence_interval ?? undefined,
        allow_delay: task.allow_delay ?? true,
        image_urls: task.image_urls || [],
      });
    } else {
      form.reset({
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        assigned_to: [],
        due_date: null,
        group_id: 'no-group',
        recurrence_type: 'none',
        recurrence_interval: undefined,
        allow_delay: true,
        image_urls: [],
      });
    }
  }, [task, form]);

  useEffect(() => {
    const recurrenceType = form.watch('recurrence_type');
    if (recurrenceType === 'none') {
        form.setValue('allow_delay', true);
    } else {
        form.setValue('allow_delay', false);
    }
  }, [form, form.watch('recurrence_type')])
  
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const startCamera = async (deviceId?: string) => {
    stopCamera(); 
    
    // Base constraints, prefer environment (back) camera by default.
    let videoConstraints: MediaTrackConstraints = { facingMode: 'environment' };

    // If a specific device is selected, use that ID instead of facingMode.
    // This avoids conflicts and allows selecting front/selfie cameras.
    if (deviceId) {
        videoConstraints = { deviceId: { exact: deviceId } };
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        setCameraStream(stream);
    } catch (error) {
        console.error("Error starting camera:", error);
        toast({ variant: 'destructive', title: 'Camera Error', description: "Could not access the selected camera." });
        
        // Fallback to default camera if specific one fails
        if (deviceId) {
            startCamera(); // Try again with default constraints
        } else {
            setShowCamera(false);
        }
    }
  };

  const getCameras = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);

        if (videoDevices.length > 0) {
            // Prefer a camera with 'back' in its label, otherwise use the first one
            const rearCamera = videoDevices.find(device => device.label.toLowerCase().includes('back'));
            const initialCameraId = rearCamera ? rearCamera.deviceId : videoDevices[0].deviceId;
            setSelectedCameraId(initialCameraId);
            startCamera(initialCameraId);
        } else {
            startCamera(); // Start with default constraints if no devices listed
        }
    } catch (error) {
        console.error("Error enumerating devices:", error);
        startCamera(); // Fallback to default if enumeration fails
    }
  };
  
  const handleOpenCamera = () => {
    setShowCamera(true);
    getCameras();
  };

  const handleCloseCamera = () => {
    stopCamera();
    setShowCamera(false);
  };
  
  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
        const currentIndex = cameras.findIndex(c => c.deviceId === selectedCameraId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        const nextCameraId = cameras[nextIndex].deviceId;
        setSelectedCameraId(nextCameraId);
        startCamera(nextCameraId);
    }
  };
  
  const handleCameraSelectionChange = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    startCamera(deviceId);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
        canvasRef.current.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setImageFiles(prev => [...prev, file]);
          }
        }, 'image/jpeg');
        handleCloseCamera();
      }
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setImageFiles(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const removeExistingImage = (imageUrl: string) => {
    const currentUrls = form.getValues('image_urls') || [];
    form.setValue('image_urls', currentUrls.filter(url => url !== imageUrl));
  }


  const watchedRecurrenceType = form.watch('recurrence_type');
  const assignedUsers = form.watch('assigned_to') || [];
  const existingImageUrls = form.watch('image_urls') || [];
  
  const onSubmit = async (values: TaskFormValues) => {
    if (!selectedUser) {
        toast({ variant: 'destructive', title: 'You must be logged in to create a task.' });
        return;
    }
    
    setIsUploading(true);

    try {
        const uploadedImageUrls: string[] = [];
        for (const file of imageFiles) {
            const url = await uploadTaskImage(file);
            uploadedImageUrls.push(url);
        }
        
        const finalImageUrls = [...(values.image_urls || []), ...uploadedImageUrls];
        const groupId = values.group_id === 'no-group' ? null : values.group_id;

        if (task) { // This is an update
             const updateData: TaskUpdate = {
                title: values.title,
                description: values.description,
                status: values.status,
                priority: values.priority,
                due_date: values.due_date ? values.due_date.toISOString() : null,
                assigned_to: values.assigned_to?.[0] || null,
                group_id: groupId,
                recurrence_type: values.recurrence_type,
                recurrence_interval: values.recurrence_interval,
                allow_delay: values.allow_delay,
                image_urls: finalImageUrls
            };
            await updateTask(task.id, updateData);
            toast({ title: 'Task Updated', description: 'The task has been successfully updated.' });

        } else { // This is a create
            const insertData: TaskInsert = {
                title: values.title,
                description: values.description,
                status: values.status,
                priority: values.priority,
                due_date: values.due_date ? values.due_date.toISOString() : null,
                created_by: selectedUser.id,
                assigned_to: values.assigned_to || [],
                group_id: groupId,
                recurrence_type: values.recurrence_type,
                recurrence_interval: values.recurrence_interval,
                allow_delay: values.allow_delay,
                image_urls: finalImageUrls
            };
            await createTask(insertData);
            toast({ title: 'Task(s) Created', description: 'New task occurrences have been generated.' });
        }
        onFinished();
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'An error occurred',
            description: error.message,
        });
    } finally {
        setIsUploading(false);
    }
  };

  const isRecurring = watchedRecurrenceType !== 'none';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Design the new homepage" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Add more details about the task..." {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2 rounded-md border p-4">
            <h3 className="font-medium flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Attachments</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {[...existingImageUrls, ...imageFiles].map((item, index) => {
                    const isExisting = typeof item === 'string';
                    const src = isExisting ? item : URL.createObjectURL(item as File);
                    return (
                        <div key={index} className="relative aspect-square">
                            <Image src={src} alt="Task image" layout="fill" className="rounded-md object-cover" />
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                onClick={() => isExisting ? removeExistingImage(item) : removeImage(index - existingImageUrls.length)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-2 pt-2">
                <Label htmlFor="file-upload" className="flex-1">
                    <Button type="button" asChild variant="outline" className="w-full cursor-pointer">
                       <span><Upload className="mr-2" /> Upload</span>
                    </Button>
                    <Input id="file-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                </Label>
                 <Button type="button" variant="outline" className="flex-1" onClick={handleOpenCamera}>
                    <Camera className="mr-2" /> Camera
                </Button>
            </div>
             {showCamera && (
                <Dialog open={showCamera} onOpenChange={handleCloseCamera}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Live Camera</DialogTitle></DialogHeader>
                        <video ref={videoRef} className="w-full rounded-md bg-black" autoPlay playsInline muted />
                        <div className="flex flex-col sm:flex-row gap-2">
                           <Select value={selectedCameraId} onValueChange={handleCameraSelectionChange}>
                               <SelectTrigger>
                                   <SelectValue placeholder="Select Camera" />
                               </SelectTrigger>
                               <SelectContent>
                                   {cameras.map((camera) => (
                                       <SelectItem key={camera.deviceId} value={camera.deviceId}>
                                           {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                                       </SelectItem>
                                   ))}
                               </SelectContent>
                           </Select>
                           <Button onClick={handleSwitchCamera} variant="outline" disabled={cameras.length <= 1}>
                               <SwitchCamera className="mr-2 h-4 w-4" />
                               Switch
                           </Button>
                        </div>
                        <Button onClick={capturePhoto} size="lg">
                            <Camera className="mr-2"/>
                            Capture Photo
                        </Button>
                    </DialogContent>
                </Dialog>
             )}
             <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                    <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="undone">Undone</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a priority" /></SelectTrigger></FormControl>
                    <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Assign To</FormLabel>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <FormControl>
                            <Button
                            variant="outline"
                            className="w-full justify-start h-auto min-h-10 text-left font-normal"
                            >
                            <div className="flex gap-1 flex-wrap">
                                {assignedUsers.length === 0 ? <span className="text-muted-foreground">Select users...</span> :
                                users
                                .filter((user) => assignedUsers.includes(user.id))
                                .map((user) => (
                                    <Badge
                                    variant="secondary"
                                    key={user.id}
                                    className="mr-1"
                                    >
                                    {user.name}
                                    </Badge>
                                ))}
                            </div>
                            </Button>
                        </FormControl>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                        {users.map((user) => (
                           <DropdownMenuCheckboxItem
                            key={user.id}
                            checked={field.value?.includes(user.id)}
                            onCheckedChange={(checked) => {
                                if (isRecurring) {
                                    // For recurring tasks, only allow one user
                                    field.onChange(checked ? [user.id] : []);
                                } else {
                                    // For non-recurring tasks, allow multiple
                                    return checked
                                    ? field.onChange([...(field.value || []), user.id])
                                    : field.onChange(
                                        field.value?.filter(
                                        (value) => value !== user.id
                                        )
                                    )
                                }
                            }}
                            onSelect={(e) => e.preventDefault()} // prevent menu from closing on select
                          >
                            {user.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                   </DropdownMenu>
                   {isRecurring && <FormDescription>Recurring tasks can only be assigned to one user.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{isRecurring ? 'End Date' : 'Due Date'} (Optional)</FormLabel>
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
        <FormField
            control={form.control}
            name="group_id"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Group (Optional)</FormLabel>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} value={field.value || 'no-group'}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Assign to a group" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="no-group">No Group</SelectItem>
                                {taskGroups?.map(group => (
                                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <CreateGroupDialog 
                            onGroupCreated={(newGroup) => {
                                mutateGroups(); // Re-fetch groups
                                field.onChange(newGroup.id); // Set the new group as selected
                            }}
                        />
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <div className="space-y-4 rounded-md border p-4">
            <h3 className="font-medium">Recurrence & Behavior</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="recurrence_type"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Repeats</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select recurrence" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="custom_days">Every # of Days</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {watchedRecurrenceType === 'custom_days' && (
                     <FormField
                        control={form.control}
                        name="recurrence_interval"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Interval (Days)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g. 3" {...field} value={field.value ?? ''} />
                            </FormControl>
                             <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
             <FormDescription>
                When a recurring task is created, individual tasks will be generated up to the End Date.
            </FormDescription>

            {watchedRecurrenceType !== 'none' && (
                <FormField
                    control={form.control}
                    name="allow_delay"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
                            <div className="space-y-0.5">
                                <FormLabel>Allow task to be delayed?</FormLabel>
                                <FormDescription>
                                    If on, missed tasks will roll over to the next day. If off, they will be marked as 'undone'.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            )}
        </div>


        <div className="pt-6 flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting || isUploading}>
              {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Save Task'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
