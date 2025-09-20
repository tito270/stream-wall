import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';

const ProtectedRoute: React.FC = () => {
    const [isAuth, setIsAuth] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const authenticated = await isAuthenticated();
            setIsAuth(authenticated);
        };
        checkAuth();
    }, []);

    if (isAuth === null) {
        return <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-foreground">Loading...</div>
        </div>;
    }

    return isAuth ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;
