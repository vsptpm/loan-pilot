
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Loader2, UserCircle, LockKeyhole, Eye, EyeOff, Save, UploadCloud } from 'lucide-react';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, storage } from '@/lib/firebase'; // Import storage
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

const profileFormSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }).max(50, { message: 'Full name is too long.' }),
  newProfileImage: z
    .instanceof(File)
    .optional()
    .nullable()
    .refine(
      (file) => !file || file.size <= MAX_FILE_SIZE,
      `Max image size is 2MB.`
    )
    .refine(
      (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .jpeg, .png and .gif formats are accepted."
    ),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, { message: 'Current password must be at least 6 characters.' }),
  newPassword: z.string().min(6, { message: 'New password must be at least 6 characters.' }),
  confirmNewPassword: z.string().min(6, { message: 'Confirm password must be at least 6 characters.' }),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match.",
  path: ['confirmNewPassword'],
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isProfileUpdating, setIsProfileUpdating] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);


  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: '',
      newProfileImage: null,
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        fullName: user.displayName || '',
        newProfileImage: null, // Reset file input
      });
      setImagePreview(user.photoURL); // Set initial preview to current user photo
    }
  }, [user, profileForm]);
  
  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);


  const handleProfileUpdate = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
      return;
    }
    setIsProfileUpdating(true);
    setUploadProgress(null);

    let finalPhotoURL = user.photoURL; // Keep current photoURL by default

    try {
      if (values.newProfileImage) {
        const file = values.newProfileImage;
        const storageRef = ref(storage, `profileImages/${user.uid}/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Upload failed:", error);
              toast({ title: 'Image Upload Failed', description: error.message, variant: 'destructive' });
              reject(error);
            },
            async () => {
              finalPhotoURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }

      await updateProfile(user, {
        displayName: values.fullName,
        photoURL: finalPhotoURL,
      });
      toast({ title: 'Success', description: 'Profile updated successfully!' });
      // AuthProvider should pick up the changes via onAuthStateChanged
      // and update the user object in context, triggering navbar update.
      profileForm.reset({ fullName: values.fullName, newProfileImage: null }); // Reset form, clear file input
      if (finalPhotoURL && finalPhotoURL !== imagePreview && !finalPhotoURL.startsWith('blob:')) {
        setImagePreview(finalPhotoURL); // Update preview to the new persistent URL
      }


    } catch (error: any) {
      // Error is already toasted by uploadTask error handler or if updateProfile itself fails.
      if (!values.newProfileImage) { // only toast if it's not an upload error which is handled above
         toast({ title: 'Error updating profile', description: error.message, variant: 'destructive' });
      }
    } finally {
      setIsProfileUpdating(false);
      setUploadProgress(null);
    }
  };

  const handleChangePassword = async (values: PasswordFormValues) => {
    if (!user || !user.email) {
      toast({ title: 'Error', description: 'User not found or email missing.', variant: 'destructive' });
      return;
    }
    setIsPasswordChanging(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, values.newPassword);
      toast({ title: 'Success', description: 'Password changed successfully!' });
      passwordForm.reset();
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect current password. Please try again.';
        passwordForm.setError('currentPassword', { type: 'manual', message: errorMessage});
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'The new password is too weak.';
        passwordForm.setError('newPassword', { type: 'manual', message: errorMessage});
      }
      toast({ title: 'Error changing password', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsPasswordChanging(false);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name && !user?.email) return 'U';
    if (!name) return user!.email!.substring(0, 2).toUpperCase();
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
  };
  

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-headline tracking-tight">Settings</h1>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserCircle className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-headline">Profile Information</CardTitle>
          </div>
          <CardDescription>Update your display name and profile picture.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={imagePreview || undefined} alt={profileForm.getValues('fullName') || user?.displayName || "User"} data-ai-hint="profile person"/>
              <AvatarFallback className="text-2xl bg-muted">
                {getInitials(profileForm.getValues('fullName') || user?.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{profileForm.watch('fullName') || user?.displayName || 'User Name'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
              <FormField
                control={profileForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="newProfileImage"
                render={({ field: { onChange, value, ...restField } }) => (
                  <FormItem>
                    <FormLabel>New Profile Picture</FormLabel>
                    <FormControl>
                      <Input 
                        type="file" 
                        accept="image/png, image/jpeg, image/gif"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          onChange(file || null);
                          if (file) {
                            if (imagePreview && imagePreview.startsWith('blob:')) {
                                URL.revokeObjectURL(imagePreview); 
                            }
                            setImagePreview(URL.createObjectURL(file));
                          } else if (!user?.photoURL) { // if no file selected and no existing user photo, clear preview
                            if (imagePreview && imagePreview.startsWith('blob:')) {
                                URL.revokeObjectURL(imagePreview); 
                            }
                            setImagePreview(null);
                          } else { // if no file selected but there is an existing photo, revert preview to it
                             if (imagePreview && imagePreview.startsWith('blob:')) {
                                URL.revokeObjectURL(imagePreview); 
                            }
                            setImagePreview(user.photoURL);
                          }
                        }}
                        {...restField}
                      />
                    </FormControl>
                    <FormDescription>Optional. Max 2MB. JPG, PNG, GIF.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {uploadProgress !== null && (
                <div className="space-y-1">
                  <Label className="text-xs">Upload Progress: {Math.round(uploadProgress)}%</Label>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
              <Button type="submit" disabled={isProfileUpdating}>
                {isProfileUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Profile
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg">
        <CardHeader>
           <div className="flex items-center gap-3">
            <LockKeyhole className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-headline">Change Password</CardTitle>
          </div>
          <CardDescription>Update your account password. Choose a strong, unique password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <div className="relative">
                        <FormControl>
                        <Input type={showCurrentPassword ? 'text' : 'password'} placeholder="Enter current password" {...field} className="pr-10" />
                        </FormControl>
                        <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                        >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                     <div className="relative">
                        <FormControl>
                        <Input type={showNewPassword ? 'text' : 'password'} placeholder="Enter new password" {...field} className="pr-10" />
                        </FormControl>
                        <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                        >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <div className="relative">
                        <FormControl>
                        <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm new password" {...field} className="pr-10" />
                        </FormControl>
                        <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPasswordChanging}>
                {isPasswordChanging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                Change Password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

