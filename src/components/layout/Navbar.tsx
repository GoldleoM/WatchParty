import React from 'react';
import { Link } from 'react-router-dom';
import { MdMovieFilter } from 'react-icons/md';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors">
          <MdMovieFilter className="w-8 h-8" />
          <span className="font-bold text-xl tracking-tight text-foreground">SyncWatch</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-secondary px-3 py-1.5 rounded-full border border-border">
                <Avatar name={user.displayName} size="sm" />
                <span className="text-sm font-medium">{user.displayName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Not logged in</div>
          )}
        </div>
      </div>
    </nav>
  );
};
