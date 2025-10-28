import React from 'react';
import { FiPlus, FiLogOut, FiMessageSquare } from 'react-icons/fi'; // Added FiMessageSquare
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

// --- MODIFIED: Added conversations and onSelectConversation props ---
function Sidebar({ handleNewChat, conversations, onSelectConversation }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex flex-col justify-between w-64 bg-gray-100 dark:bg-gray-800 p-6 shadow-xl transition-colors duration-300">
            <div className="flex flex-col flex-grow overflow-hidden"> {/* Added flex-grow and overflow-hidden */}
                <div className="flex items-center space-x-3 mb-8 flex-shrink-0"> {/* Added flex-shrink-0 */}
                    <img src={logo} alt="VAULT Logo" className="w-8 h-8" />
                    <span className="text-xl font-bold text-gray-900 dark:text-white">VAULT</span>
                </div>

                <button
                    onClick={handleNewChat}
                    className="flex items-center justify-center w-full px-4 py-3 mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 flex-shrink-0" /* Added flex-shrink-0 and mb-6 */
                >
                    <FiPlus className="mr-2" size={20} /> New Chat
                </button>

                {/* --- Conversation List --- */}
                <div className="flex-grow overflow-y-auto space-y-2 pr-2"> {/* Added flex-grow, overflow-y-auto, space-y-2, pr-2 */}
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Chat History
                    </h3>
                    {conversations && conversations.length > 0 ? (
                        conversations.map((convo) => (
                            <button
                                key={convo.conversation_id}
                                // --- MODIFIED: Added onClick handler ---
                                onClick={() => onSelectConversation(convo.conversation_id)}
                                className="flex items-center w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors duration-150 truncate"
                                title={convo.title} // Show full title on hover
                            >
                                <FiMessageSquare className="mr-3 flex-shrink-0" size={16} />
                                <span className="truncate">{convo.title}</span>
                            </button>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2 italic">
                            No chat history yet.
                        </p>
                    )}
                </div>
                {/* --- End Conversation List --- */}

            </div>

            {/* --- User Profile & Logout Section --- */}
            <div className="flex-shrink-0 pt-4 border-t border-gray-200 dark:border-gray-700"> {/* Added flex-shrink-0, pt-4, border-t */}
                {user && user.email && (
                    <div className="flex items-center space-x-3 p-2 mb-2"> {/* Added mb-2 */}
                        {user.pictureUrl ? (
                            <img
                                src={user.pictureUrl}
                                alt="User Avatar"
                                className="w-10 h-10 rounded-full"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold text-lg">
                                {user.email.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {user.email}
                        </span>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-semibold transition-colors duration-200"
                >
                    <FiLogOut className="mr-3" size={20} /> Logout
                </button>
            </div>
        </div>
    );
}

export default Sidebar;