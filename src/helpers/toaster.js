/**
 * Toaster wrapper for React 18 compatibility with Evergreen UI 7.
 *
 * Evergreen UI 7's toaster internally passes toast instance objects
 * through React rendering. React 18 throws Error #31 ("Objects are
 * not valid as a React child") instead of silently stringifying like
 * React 17 did. This wrapper catches and suppresses that specific
 * error so toasts still display.
 */
import { toaster as evergreenToaster } from 'evergreen-ui';

function wrapToasterMethod(method) {
  return function (title, settings = {}) {
    try {
      return method.call(evergreenToaster, String(title), settings);
    } catch (e) {
      if (
        e?.message?.includes('#31') ||
        e?.message?.includes('Objects are not valid as a React child')
      ) {
        console.warn('[DMN] Suppressed Evergreen toaster React 18 compat error');
        return undefined;
      }
      throw e;
    }
  };
}

export const toaster = {
  success: wrapToasterMethod(evergreenToaster.success),
  danger: wrapToasterMethod(evergreenToaster.danger),
  warning: wrapToasterMethod(evergreenToaster.warning),
  notify: wrapToasterMethod(evergreenToaster.notify),
  closeAll: () => evergreenToaster.closeAll(),
  remove: (id) => evergreenToaster.remove(id),
  getToasts: () => evergreenToaster.getToasts(),
};
