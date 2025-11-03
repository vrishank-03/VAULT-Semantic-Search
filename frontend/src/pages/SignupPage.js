import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// --- [MODIFIED] Removed checkVerificationStatus ---
import { signupUser, getConfirmedProducts } from '../services/api';
import AuthLayout from '../components/AuthLayout';
// --- [MODIFIED] Import GenericSuccessAnimation (removed unused SuccessAnimation) ---
import GenericSuccessAnimation from '../components/GenericSuccessAnimation';
import GoogleLoginButton from '../components/GoogleLoginButton';
import Toast from '../Toast';
// --- [MODIFIED] Removed unused LoadingSpinner ---

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

    // --- [NEW] State for RBAC Signup ---
    const [role, setRole] = useState('User'); // 'User' or 'Administrator'
    const [productName, setProductName] = useState(''); // Selected product for Admin
    
    // --- [NEW] Placeholder for product list. We will fetch this in the next step. ---
    const [productList, setProductList] = useState([]); 
    const [isProductListLoading, setIsProductListLoading] = useState(false);
    // --- [END NEW] ---

    // --- [REMOVED] Old polling useEffect has been removed ---

    useEffect(() => {
        setPasswordErrors(password ? validatePassword(password) : []);
    }, [password]);

    // --- [MODIFIED] Effect to fetch REAL products on component mount ---
    useEffect(() => {
        const fetchProducts = async () => {
            console.log('[SIGNUP_EFFECT] Page loaded. Fetching product list...');
            setIsProductListLoading(true);
            setProductList([]); // Clear old list
            
            try {
                // --- [MODIFIED] This is now a REAL API call ---
                console.log('[SIGNUP_EFFECT_API] Calling getConfirmedProducts()...');
                const response = await getConfirmedProducts();
                console.log(`[SIGNUP_EFFECT_API_SUCCESS] Found ${response.data.length} products.`);
                setProductList(response.data);
                // --- [END MODIFIED] ---

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
    // --- [END MODIFIED] ---

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

        // 2. [MODIFIED] Validate Product Name (now required for ALL roles)
        if (!productName) {
            const errorMsg = 'Please select a product.';
            console.warn(`[SIGNUP_SUBMIT_WARN] Validation failed: ${errorMsg}`);
            setToast({ message: errorMsg, type: 'error' });
            return;
        }
        // --- [END MODIFIED] ---

        console.log('[SIGNUP_SUBMIT] Validation passed. Setting loading state.');
        setIsLoading(true);

        // 3. [MODIFIED] Create payload with role (productName is now always sent)
        const payload = {
            email,
            password,
            role,
            productName: productName 
        };
        // --- [END MODIFIED] ---

        console.log('[SIGNUP_SUBMIT_API] Calling signupUser with payload:', payload);

        try {
            await signupUser(payload); // Send new payload to backend
            console.log('[SIGNUP_SUBMIT_API_SUCCESS] Signup request successful.');
            setIsLoading(false);
            // --- [MODIFIED] Set step to 'success' instead of 'verifying' ---
            setStep('success');
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
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            Please verify your email. Once verified, your account will be placed in the queue for administrator approval.
                        </p>
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
                
                // --- [MODIFIED] Check button disabled logic (productName always required) ---
                const isSubmitDisabled = 
                    isLoading || 
                    (password.length > 0 && passwordErrors.length > 0) ||
                    !productName;
                // --- [END MODIFIED] ---

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
                            
                            {/* --- [MODIFIED] Product Dropdown (now always visible) --- */}
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
                            {/* --- [END MODIFIED] --- */}

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
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-600" /></div>
                            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-gray-800/80 text-gray-500 dark:text-gray-400">Or</span></div>
                        </div>
                        <GoogleLoginButton setError={(msg) => setToast({ message: msg, type: 'error' })} />
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