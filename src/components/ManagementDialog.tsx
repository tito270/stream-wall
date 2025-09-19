import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type User = {
  id: string;
  username: string;
  roles: string[];
};

const allRoles = [
  "add_streams",
  "save_lists", 
  "load_lists",
  "download_logs",
  "delete_streams",
] as const;

const ManagementDialog: React.FC<ManagementDialogProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ email: '', password: '' });
  const { toast } = useToast();
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      // Get profiles and their roles from Supabase
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, username');
        
      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
        
      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: User[] = profiles?.map(profile => ({
        id: profile.user_id,
        username: profile.username,
        roles: userRoles
          ?.filter(ur => ur.user_id === profile.user_id)
          ?.map(ur => ur.role) || []
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch users",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isOpen) fetchUsers();
  }, [isOpen]);

  const createUser = async () => {
    if (newUser.email.trim().length < 3 || newUser.password.length < 6) {
      toast({
        title: "Error",
        description: "Email must be at least 3 characters and password at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create user via Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      });

      if (error) throw error;

      toast({
        title: "Success", 
        description: "User created successfully",
      });
      setNewUser({ email: '', password: '' });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (userId: string, role: string, value: boolean) => {
    try {
      if (value) {
        // Add role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: role as any });
        if (error) throw error;
      } else {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);
        if (error) throw error;
      }
      
      fetchUsers();
      toast({
        title: "Success",
        description: `Role ${value ? 'added' : 'removed'} successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Delete from auth.users (this will cascade to profiles and user_roles)
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      fetchUsers();
      setConfirmDeleteUser(null);
    } catch (error: any) {
      toast({
        title: "Error", 
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handlePasswordChange = async (userId: string) => {
    const newPassword = prompt("Enter new password (min 6 characters):");
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password", 
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Management</DialogTitle>
          </DialogHeader>

          {/* Create User Form */}
          <form 
            onSubmit={(e) => { e.preventDefault(); createUser(); }}
            className="space-y-4 p-4 border rounded-lg bg-muted/50"
          >
            <h3 className="text-lg font-semibold">Create New User</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>
            </div>
            
            <div>
              <Button
                type="submit"
                disabled={
                  newUser.email.trim().length < 3 || newUser.password.length < 6
                }
              >
                Create User
              </Button>
            </div>
          </form>

          {/* Users List */}
          <div className="mt-2">
            <h3 className="text-lg font-semibold mb-3">Users and Permissions</h3>

            <div className="max-h-[60vh] overflow-y-auto pr-2">
              {users.map((user) => (
                <div key={user.id} className="mb-4 p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold">
                      {user.username} ({user.roles.includes('admin') ? 'admin' : 'user'})
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePasswordChange(user.id)}
                      >
                        Change Password
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={user.roles.includes('admin')}
                        onClick={() => setConfirmDeleteUser(user.id)}
                      >
                        Delete User
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                    {allRoles.map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Switch
                          id={`${user.id}-${role}`}
                          checked={user.roles.includes(role)}
                          onCheckedChange={(value) =>
                            handleRoleChange(user.id, role, value)
                          }
                          disabled={user.roles.includes('admin')}
                        />
                        <Label
                          htmlFor={`${user.id}-${role}`}
                          className="text-sm font-medium"
                        >
                          {role}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={confirmDeleteUser !== null} 
        onOpenChange={() => setConfirmDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteUser && handleDeleteUser(confirmDeleteUser)}
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ManagementDialog;