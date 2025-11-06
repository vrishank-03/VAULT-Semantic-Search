import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// --- [SIGNUP_FIX] Import signupAdmin and new getAdminsForProduct ---
import { signupUser, signupAdmin, getConfirmedProducts, getAdminsForProduct } from '../services/api';
import AuthLayout from '../components/AuthLayout';
import GenericSuccessAnimation from '../components/GenericSuccessAnimation';
import Toast from '../Toast';

const validatePassword = (password) => {
    // ... (validation logic remains the same)
    const errors = [];
    if (password.length < 8) errors.push("at least 8 characters");
    if (!/[a-z]/.test(password)) errors.push("a lowercase letter");
    if (!/[A-Z]/.test(password)) errors.push("an uppercase letter");
    if (!/\d/.test(password)) errors.push("a number");
    if (!/[!@#$%^&*]/.test(password)) errors.push("a special character (!@#$%^&*)");
    return errors;
};

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [toast, setToast] = useState(null);
    const [passwordErrors, setPasswordErrors] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const [step, setStep] = useState('form');

    // --- State for RBAC Signup ---
    const [role, setRole] = useState('User'); // 'User' or 'Administrator'
    const [productName, setProductName] = useState(''); 
    
    const [productList, setProductList] = useState([]); 
    const [isProductListLoading, setIsProductListLoading] = useState(false);
    
    // --- [SIGNUP_FIX] State for Admin dropdown ---
    const [adminId, setAdminId] = useState(''); // Selected admin for User
    const [adminList, setAdminList] = useState([]);
    const [isAdminListLoading, setIsAdminListLoading] = useState(false);
    // --- [END SIGNUP_FIX] ---

    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        setPasswordErrors(password ? validatePassword(password) : []);
    }, [password]);

    // --- Effect to fetch REAL products on component mount ---
    useEffect(() => {
        const fetchProducts = async () => {
            console.log('[SIGNUP_EFFECT] Page loaded. Fetching product list...');
            setIsProductListLoading(true);
            setProductList([]); // Clear old list
            
            try {
                console.log('[SIGNUP_EFFECT_API] Calling getConfirmedProducts()...');
                const response = await getConfirmedProducts();
                console.log(`[SIGNUP_EFFECT_API_SUCCESS] Found ${response.data.length} products.`);
                setProductList(response.data);
            } catch (err) {
                console.error('[SIGNUP_EFFECT_API_ERROR] Failed to fetch products:', err.response?.data?.message || err.message);
                setToast({ message: 'Could not load products. Please try again later.', type: 'error' });
            } finally {
                setIsProductListLoading(false);
                console.log('[SIGNUP_EFFECT_API] Finished fetching products.');
            }
        };

        fetchProducts();
    }, []); // --- Runs once on mount

    // --- [SIGNUP_FIX] NEW Effect to fetch Admins when Product changes ---
    useEffect(() => {
        const fetchAdmins = async () => {
            if (role === 'User' && productName) {
                console.log(`[SIGNUP_EFFECT_ADMINS] Product changed to ${productName}. Fetching admins...`);
                setIsAdminListLoading(true);
                setAdminList([]);
                setAdminId(''); // Reset selection
                
                try {
                    const response = await getAdminsForProduct(productName);
                    console.log(`[SIGNUP_EFFECT_ADMINS_SUCCESS] Found ${response.data.length} admins.`);
                    setAdminList(response.data);
                } catch (err) {
                    console.error('[SIGNUP_EFFECT_ADMINS_ERROR] Failed to fetch admins:', err.response?.data?.message || err.message);
                    setToast({ message: 'Could not load administrators for that product.', type: 'error' });
                } finally {
                    setIsAdminListLoading(false);
                }
            } else {
                // If not a User or no product, clear the admin list
                setAdminList([]);
                setAdminId('');
            }
        };

        fetchAdmins();
    }, [productName, role]); // Re-run when product OR role changes
    // --- [END SIGNUP_FIX] ---


    const handleSubmit = async (e) => {
        e.preventDefault();
        setToast(null);
        console.log('[SIGNUP_SUBMIT] Form submitted.');

        // 1. Validate Password
        const validationErrors = validatePassword(password);
        if (validationErrors.length > 0) {
            const errorMsg = `Password is missing: ${validationErrors.join(', ')}.`;
            console.warn(`[SIGNUP_SUBMIT_WARN] Validation failed: ${errorMsg}`);
            setToast({ message: errorMsg, type: 'error' });
            return;
        }

        // 2. Validate Product Name
        if (!productName) {
            const errorMsg = 'Please select a product.';
            console.warn(`[SIGNUP_SUBMIT_WARN] Validation failed: ${errorMsg}`);
            setToast({ message: errorMsg, type: 'error' });
            return;
        }

        // --- [SIGNUP_FIX] 3. Validate Admin ID if role is User ---
        if (role === 'User' && !adminId) {
            const errorMsg = 'Please select an administrator.';
            console.warn(`[SIGNUP_SUBMIT_WARN] Validation failed: ${errorMsg}`);
            setToast({ message: errorMsg, type: 'error' });
            return;
        }
        // --- [END SIGNUP_FIX] ---

        console.log('[SIGNUP_SUBMIT] Validation passed. Setting loading state.');
        setIsLoading(true);

        // 4. Create payload
        const payload = {
            email,
            password,
            productName: productName,
            adminId: role === 'User' ? adminId : undefined // Only send adminId if User
        };
        
        // --- [SIGNUP_FIX] Call correct API based on role ---
        try {
            if (role === 'Administrator') {
                console.log('[SIGNUP_SUBMIT_API] Calling signupAdmin with payload:', payload);
                await signupAdmin(payload);
                setSuccessMessage('Please verify your email. Once verified, your account will be placed in the queue for Product Owner approval.');
            } else { // Default to 'User'
                console.log('[SIGNUP_SUBMIT_API] Calling signupUser with payload:', payload);
                await signupUser(payload);
                setSuccessMessage('Please verify your email. Once verified, your account will be placed in the queue for administrator approval.');
            }
            
            console.log('[SIGNUP_SUBMIT_API_SUCCESS] Signup request successful.');
            setIsLoading(false);
            setStep('success');
        // --- [END SIGNUP_FIX] ---
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to sign up. The email might already be in use.';
            console.error('[SIGNUP_SUBMIT_API_ERROR] Signup failed:', errorMessage);
            setToast({ message: errorMessage, type: 'error' });
            setIsLoading(false);
        }
    };

    // --- [NEW] Handler for role change ---
    const handleRoleChange = (newRole) => {
        console.log(`[SIGNUP_PAGE] Role changed to: ${newRole}`);
        setRole(newRole);
    };

    const renderContent = () => {
        switch (step) {
            // --- [NEW] 'success' case replaces 'verifying' and 'verified' ---
            case 'success':
                console.log('[SIGNUP_RENDER] Rendering "success" step.');
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Created!</h2>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            A verification link has been sent to <br />
                            <strong className="text-blue-600 dark:text-blue-400">{email}</strong>.
                        </p>
                        <div className="my-6">
                            <GenericSuccessAnimation message="Email Sent!" />
                        </div>
                        {/* --- [SIGNUP_FIX] Use dynamic success message --- */}
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            {successMessage}
                        </p>
                        {/* --- [END SIGNUP_FIX] --- */}
                        <p className="!mt-6 text-sm text-center text-gray-500 dark:text-gray-400">
                            <Link to="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-500">
                                Back to Login
                            </Link>
                        </p>
                    </div>
                );
            // --- [END NEW] ---
            case 'form':
            default:
                console.log('[SIGNUP_RENDER] Rendering "form" step.');
                
                // --- [SIGNUP_FIX] Modified disabled logic ---
                const isSubmitDisabled = 
                    isLoading || 
                    (password.length > 0 && passwordErrors.length > 0) ||
                    !productName ||
                    (role === 'User' && !adminId); // Must select admin if user
                // --- [END SIGNUP_FIX] ---

                return (
                    <>
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Create Your Account</h2>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">Join VAULT to start securing your knowledge.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            
                            {/* --- [NEW] Role Selector --- */}
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Sign up as:</label>
                                <div className="flex gap-4">
                                    <label className="flex-1 flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/30 has-[:checked]:border-blue-500">
                                        <input type="radio" name="role" value="User" checked={role === 'User'} onChange={() => handleRoleChange('User')} className="w-4 h-4 text-blue-600" />
                                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-100">User</span>
                                    </label>
                                    <label className="flex-1 flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/30 has-[:checked]:border-blue-500">
                                        <input type="radio" name="role" value="Administrator" checked={role === 'Administrator'} onChange={() => handleRoleChange('Administrator')} className="w-4 h-4 text-blue-600" />
                                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-100">Administrator</span>
                                    </label>
                                </div>
                            </div>
                            
                            {/* --- Product Dropdown --- */}
                            <div className="animate-in fade-in duration-300">
                                <label htmlFor="product-name" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Product</label>
                                <select 
                                    id="product-name" 
                                    value={productName} 
                                    onChange={(e) => {
                                        console.log(`[SIGNUP_PAGE] Product selected: ${e.target.value}`);
                                        setProductName(e.target.value);
                                    }} 
                                    required 
                                    className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                >
                                    <option value="" disabled>
                                        {isProductListLoading ? 'Loading products...' : 'Select a product...'}
                                    </option>
                                    
                                    {!isProductListLoading && productList.length === 0 && (
                                        <option value="" disabled>No confirmed products found.</option>
                                    )}

                                    {productList.map((product) => (
                                        <option key={product.id} value={product.product_name}>
                                            {product.product_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* --- [SIGNUP_FIX] NEW Administrator Dropdown --- */}
                            {role === 'User' && (
                                <div className="animate-in fade-in duration-300">
                                    <label htmlFor="admin-id" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Administrator</label>
                                    <select 
                                        id="admin-id" 
                                        value={adminId} 
                                        onChange={(e) => {
                                            console.log(`[SIGNUP_PAGE] Admin selected: ${e.target.value}`);
                                            setAdminId(e.target.value);
                                        }} 
                                        required 
                                        disabled={!productName || isAdminListLoading} // Disable if no product or if loading
                                        className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50"
                                    >
                                        <option value="" disabled>
                                            {!productName ? 'Select a product first' : 
                                            isAdminListLoading ? 'Loading admins...' : 'Select your administrator...'}
                                        </option>
                                        
                                        {!isAdminListLoading && adminList.length === 0 && productName && (
                                            <option value="" disabled>No active admins found for this product.</option>
                                        )}

                                        {adminList.map((admin) => (
                                            <option key={admin.id} value={admin.id}>
                                                {admin.email}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {/* --- [END SIGNUP_FIX] --- */}

                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Create a strong password" className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                            </div>
                            {password.length > 0 && passwordErrors.length > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-1">
                                    <p className="font-medium">Password must contain:</p>
                                    <ul className="list-disc list-inside">
                                        {validatePassword("").map(rule => (
                                            <li key={rule} className={!passwordErrors.includes(rule) ? 'text-green-500 line-through' : ''}>
                                                {rule}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <button type="submit" disabled={isSubmitDisabled} className="w-full py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                {isLoading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>
                        
                        {/* --- [PHASE 1.E] REMOVED GOOGLE LOGIN --- */}
                        {/* (Google login button and 'Or' divider removed) */}
                        {/* --- [END REMOVAL] --- */}

                        <p className="!mt-6 text-sm text-center text-gray-500 dark:text-gray-400">
                            Already have an account? <Link to="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-500">Login</Link>
                        </p>
                    </>
                );
        }
    };

    return (
        <AuthLayout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="w-full max-w-md p-8 space-y-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-2xl dark:bg-gray-800/80 transition-all duration-300">
                {renderContent()}
            </div>
        </AuthLayout>
    );
};

export default SignupPage;