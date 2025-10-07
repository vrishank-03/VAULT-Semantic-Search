import md5 from 'js-md5';

// Function to get a Gravatar URL from an email address
export const getGravatarUrl = (email, size = 100) => {
    if (!email) {
        // Return a default blank avatar or handle as preferred
        return `https://www.gravatar.com/avatar/?d=mp&s=${size}`; 
    }
    const hash = md5(email.trim().toLowerCase());
    return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=${size}`;
    // 'd=identicon' provides a unique, generated image if no Gravatar is found
    // 's=${size}' sets the size of the image
};