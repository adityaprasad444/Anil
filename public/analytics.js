/**
 * Vercel Web Analytics Integration
 * 
 * This module initializes Vercel Web Analytics on the client side using the @vercel/analytics package.
 * The inject() function must be called on the client side to enable comprehensive tracking of:
 * - Core Web Vitals (LCP, FID, CLS, etc.)
 * - Page views and navigation
 * - User interactions
 * 
 * The main analytics script (/_vercel/insights/script.js) is loaded separately via HTML <script> tags,
 * which handles automatic pageview tracking and integration with the Vercel Analytics dashboard.
 */

(function() {
  'use strict';

  // Dynamically import and initialize @vercel/analytics
  // This approach ensures analytics initializes even if the module isn't available
  async function initializeAnalytics() {
    try {
      // Import the analytics module
      const { inject } = await import('@vercel/analytics');
      
      // Call inject() to initialize Web Analytics tracking
      // This function:
      // - Sets up Core Web Vitals monitoring
      // - Enables automatic pageview tracking (when History API is used)
      // - Initializes performance monitoring
      inject();
      
      console.log('✅ Vercel Web Analytics inject() called successfully');
    } catch (error) {
      // If @vercel/analytics is not available, the fallback script.js will still work
      console.warn('⚠️ @vercel/analytics dynamic import failed, relying on /_vercel/insights/script.js:', error.message);
      
      // The /_vercel/insights/script.js handles fallback tracking
      // This ensures analytics still works even if the package isn't available
    }
  }

  // Initialize analytics when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAnalytics);
  } else {
    // DOM is already loaded
    initializeAnalytics();
  }

  // Track custom page interactions for enhanced analytics
  // These events are sent alongside Core Web Vitals data
  
  /**
   * Track user interactions with the page
   * This helps understand which features users engage with most
   */
  function trackPageInteractions() {
    document.addEventListener('click', function(e) {
      const target = e.target.closest('a, button');
      if (!target) return;

      // Skip analytics script tags and internal tracking URLs
      if (target.href && (target.href.includes('/_vercel/insights') || target.href.includes('/_vercel'))) return;

      // Send tracking event through Vercel Analytics if available
      if (window.va && typeof window.va.track === 'function') {
        const eventName = target.tagName === 'BUTTON' ? 'button_click' : 'link_click';
        const eventData = {
          element: target.className || target.id || target.textContent?.substring(0, 50) || 'unknown',
          url: target.href || 'N/A'
        };
        window.va.track(eventName, eventData);
      }
    }, { passive: true });
  }

  /**
   * Track form submissions
   * Helps understand user conversion flows and form engagement
   */
  function trackFormSubmissions() {
    document.addEventListener('submit', function(e) {
      const form = e.target;
      if (window.va && typeof window.va.track === 'function') {
        window.va.track('form_submit', {
          form_id: form.id || 'unknown',
          form_name: form.name || 'unknown'
        });
      }
    }, { passive: true });
  }

  /**
   * Track page visibility changes
   * Helps identify when users leave the page or switch tabs
   */
  function trackPageVisibility() {
    document.addEventListener('visibilitychange', function() {
      if (window.va && typeof window.va.track === 'function') {
        const action = document.hidden ? 'page_hidden' : 'page_visible';
        window.va.track(action);
      }
    }, { passive: true });
  }

  /**
   * Track error events
   * Helps identify client-side errors affecting user experience
   */
  function trackErrorEvents() {
    window.addEventListener('error', function(event) {
      if (window.va && typeof window.va.track === 'function') {
        window.va.track('error_event', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno
        });
      }
    }, { passive: true });

    window.addEventListener('unhandledrejection', function(event) {
      if (window.va && typeof window.va.track === 'function') {
        window.va.track('unhandled_promise_rejection', {
          reason: event.reason?.message || String(event.reason)
        });
      }
    }, { passive: true });
  }

  // Initialize tracking once the inject() function has had time to set up
  setTimeout(() => {
    trackPageInteractions();
    trackFormSubmissions();
    trackPageVisibility();
    trackErrorEvents();
    console.log('📊 Custom Vercel Web Analytics tracking initialized');
  }, 100);

  // Export for potential manual use or debugging
  window.analyticsReady = true;
})();
