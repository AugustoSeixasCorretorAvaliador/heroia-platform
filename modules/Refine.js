
async function handleRefineClick() {


			const res = await callBackend("/whatsapp/refine", {
                 mensagem: composerText
            });

            const refined = res.refined?.trim() || composerText;

            if (refined) {
                clearComposer();
				insertTextInComposer(refined, { append: false });
				showPanel("Texto refinado. Insights:\n\n" + buildRewriteInsights(refined), "rewrite");
             } else {
                   alert("Não foi possível refinar o texto.");
          }


		}
    

    export { handleRefineClick };
