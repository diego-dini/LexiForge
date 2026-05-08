import { dom } from "../dom";
import { state } from "../state";
import type { MessageDialogOptions, OpenMessageDialogOptions } from "../types";

/** Opens the shared dialog as a prompt and resolves with the input value. */
export function showCustomPrompt({
  title,
  message,
  value = "",
  confirmText = "OK",
}: MessageDialogOptions): Promise<string | null> {
  return openMessageDialog({
    title,
    message,
    value,
    confirmText,
    mode: "prompt",
  }) as Promise<string | null>;
}

/** Opens the shared dialog as a confirmation box. */
export function showCustomConfirm({
  title,
  message,
  confirmText = "Confirm",
}: MessageDialogOptions): Promise<boolean> {
  return openMessageDialog({
    title,
    message,
    value: "",
    confirmText,
    mode: "confirm",
  }) as Promise<boolean>;
}

/** Opens the shared dialog as a message-only modal. */
export function showCustomMessage({
  title,
  message,
  confirmText = "OK",
}: MessageDialogOptions): Promise<boolean> {
  return openMessageDialog({
    title,
    message,
    value: "",
    confirmText,
    mode: "message",
  }) as Promise<boolean>;
}

/**
 * Central modal implementation used by prompt/confirm/message helpers.
 * It returns a Promise so callers can use it like `window.confirm`, but styled.
 */
function openMessageDialog({
  title,
  message,
  value,
  confirmText,
  mode,
}: OpenMessageDialogOptions): Promise<string | boolean | null> {
  closeMessageDialog(null);

  dom.messageDialogTitle.textContent = title;
  dom.messageDialogText.textContent = message;
  dom.messageDialogConfirmButton.textContent = confirmText;
  dom.messageDialogInputWrap.hidden = mode !== "prompt";
  dom.messageDialogInputWrap.classList.toggle("is-hidden", mode !== "prompt");
  dom.messageDialogCancelButton.hidden = mode === "message";
  dom.messageDialogCancelButton.classList.toggle("is-hidden", mode === "message");
  dom.messageDialogInput.value = value;
  dom.messageOverlay.hidden = false;
  dom.messageOverlay.classList.remove("is-hidden");

  if (mode === "prompt") {
    dom.messageDialogInput.focus();
    dom.messageDialogInput.select();
  } else {
    dom.messageDialogConfirmButton.focus();
  }

  return new Promise((resolve) => {
    state.messageDialogResolve = (confirmed) => {
      if (!confirmed) {
        resolve(mode === "prompt" ? null : false);
        return;
      }

      resolve(mode === "prompt" ? dom.messageDialogInput.value : true);
    };
  });
}

/** Closes the shared modal and resolves the pending dialog Promise. */
export function closeMessageDialog(confirmed: boolean | null): void {
  if (!state.messageDialogResolve) {
    return;
  }

  const resolve = state.messageDialogResolve;
  state.messageDialogResolve = null;
  dom.messageOverlay.hidden = true;
  dom.messageOverlay.classList.add("is-hidden");
  resolve(confirmed);
}
