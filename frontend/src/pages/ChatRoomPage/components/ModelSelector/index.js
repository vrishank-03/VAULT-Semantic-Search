// frontend/src/pages/ChatRoomPage/components/ModelSelector/index.js

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiZap, FiCpu, FiChevronsUp, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { TbSparkles } from 'react-icons/tb';

/**
 * Renders the UI for selecting the LLM and "Deep Thinking" mode.
 */
const ModelSelector = ({ 
    modelName, 
    setModelName, 
    isDeepThink, 
    setIsDeepThink, 
    showModelSelector, 
    setShowModelSelector 
}) => {
    
    const availableModels = [
        { id: 'auto', name: 'Auto (Recommended)', icon: FiZap, desc: 'Fastest model for most tasks.' },
        { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B', icon: TbSparkles, desc: 'Powerful, for complex reasoning.' },
        { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', icon: FiCpu, desc: 'Large model for in-depth analysis.' },
    ];
    
    const selectedModel = availableModels.find(m => m.id === modelName) || availableModels[0];

    return (
        <div className="absolute bottom-full mb-3 w-full max-w-4xl px-2">
            <AnimatePresence>
                {showModelSelector && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700"
                    >
                        <div className="mb-3">
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                Query Model
                            </label>
                            <div className="flex flex-col gap-2">
                                {availableModels.map(model => (
                                    <button
                                        key={model.id}
                                        type="button"
                                        onClick={() => { setModelName(model.id); setShowModelSelector(false); }}
                                        className={`flex items-center gap-3 w-full p-3 text-left rounded-lg transition-colors ${
                                            modelName === model.id 
                                            ? 'bg-blue-100 dark:bg-blue-900/50' 
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <model.icon className={`w-5 h-5 flex-shrink-0 ${modelName === model.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                                        <div>
                                            <p className={`text-sm font-medium ${modelName === model.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
                                                {model.name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{model.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <div className="flex items-center gap-3">
                                <FiChevronsUp className="w-5 h-5 text-purple-500" />
                                <div>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Deep Thinking Mode</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">More comprehensive, but slower answers.</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={isDeepThink}
                                onChange={(e) => setIsDeepThink(e.target.checked)}
                                className="toggle-switch" // Assumes you have a CSS class for this
                            />
                        </label>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                type="button"
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 rounded-full shadow border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
                <selectedModel.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-700 dark:text-gray-300">{selectedModel.name}</span>
                {isDeepThink && <FiChevronsUp className="w-4 h-4 text-purple-500" title="Deep Thinking Enabled" />}
                {showModelSelector ? <FiChevronDown className="w-4 h-4" /> : <FiChevronUp className="w-4 h-4" />}
            </button>
        </div>
    );
};

export default ModelSelector;