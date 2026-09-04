# Publicar as últimas alterações

## Diagnóstico
O app está íntegro: o preview abre sem erros e redireciona corretamente para o login. As alterações recentes (tela inicial "O que você quer fazer?", "Seu plano de hoje", calendário em /plano, resumo semanal, lembretes opcionais e mural de fraquezas por habilidade) estão no código.

A causa mais provável de você não vê-las: o acesso foi feito pelo app publicado/instalado (PWA), que reflete a última publicação e não o preview. O cache do navegador/PWA no celular também pode segurar a versão antiga.

## O que será feito
1. **Publicar o app** — leva todas as alterações recentes para o endereço público (study-english-pro.lovable.app).
2. **Atualizar no celular** — orientações rápidas:
   - Fechar o app instalado e abrir de novo (o PWA atualiza sozinho ao reabrir).
   - Se não atualizar: remover o app da tela inicial e instalar novamente a partir do site publicado.

## Detalhes técnicos
- Nenhuma mudança de código necessária; servidor e rotas verificados sem erros.
