// frontend/src/pages/ChatRoomPage/utils/socketEvents.js

/**
 * Defines the standard event names for the chat stream.
 */
export const CHAT_RESPONSE_EVENT = 'chat_response';
export const STOP_GENERATION_EVENT = 'stop_generation';

/**
 * Defines the sub-types of messages within a CHAT_RESPONSE_EVENT.
 */
export const STREAM_EVENTS = {
    STATUS: 'status',
    CLASSIFICATION: 'classification',
    CHUNK: 'chunk',
    FINAL: 'final',
    ERROR: 'error',
};