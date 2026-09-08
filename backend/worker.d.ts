/* Typage minimal du Worker — il tourne sur Cloudflare Workers, sans étape de build, mais
   les tests du dépôt le jouent sous Node (voir tests/payment_test.tsx) : ils ont besoin de
   savoir à quoi ressemble son point d'entrée. Rien ici n'est envoyé en production. */
export interface DdWorker {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
}
declare const worker: DdWorker;
export default worker;
