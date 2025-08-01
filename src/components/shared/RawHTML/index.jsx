import React from 'react';
import DOMPurify from 'dompurify';

/**
 * SafeHTML component for rendering sanitized HTML content
 * Follows Security Best Practices - uses DOMPurify to prevent XSS
 * Allows only safe HTML tags and converts newlines to <br> elements
 */
export function RawHTML({ children, className = '' }) {
  // Configure DOMPurify to allow only safe formatting tags
  const config = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  };

  // Convert newlines to <br> tags and sanitize the HTML
  const htmlWithBreaks = children.replace(/\n/g, '<br>');
  const sanitizedHtml = DOMPurify.sanitize(htmlWithBreaks, config);

  return (
    <span
      className={className}
      // Security Note: Using dangerouslySetInnerHTML with DOMPurify sanitization
      // This is safe because DOMPurify removes all potentially harmful content
      // semgrep:ignore dangerously-set-inner-html
      dangerouslySetInnerHTML={{
        __html: sanitizedHtml,
      }}
    />
  );
}
