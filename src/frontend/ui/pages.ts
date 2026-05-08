import { dom } from "../dom";
import { loadAiModels } from "../features/ollama-models";
import { loadPromptModels } from "../features/prompt-models";

/** Switches between app pages and lazily refreshes page-specific data. */
export function showPage(pageId: string | undefined): void {
  for (const page of dom.pages) {
    const isActive = page.id === pageId;

    page.hidden = !isActive;
    page.classList.toggle("is-active", isActive);
  }

  for (const navButton of dom.navButtons) {
    navButton.classList.toggle(
      "is-active",
      navButton.dataset.pageTarget === pageId,
    );
  }

  if (pageId === "promptEditorPage") {
    void loadPromptModels();
  }

  if (pageId === "aiModelsPage") {
    void loadAiModels();
  }
}
