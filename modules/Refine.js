// modules/refine.js
import {
  getComposerText,
  clearComposer,
  insertTextInComposer,
  buildRewriteInsights,
  showPanel,
  callBackend,
  createPanel
} from './core.js';

export async function runRefine() {
  createPanel();

  const composerText = getComposerText();
  if (!composerText) {
    alert('Digite algo para refinar.');
    return;
  }

  const res = await callBackend('/whatsapp/refine', { mensagem: composerText });
  const refined = res.refined?.trim() || composerText;

  if (!refined) {
    alert('Não foi possível refinar o texto.');
    return;
  }

  clearComposer();
  insertTextInComposer(refined, { append: false });
  showPanel('Texto refinado. Insights:\n\n' + buildRewriteInsights(refined), 'rewrite');
}
