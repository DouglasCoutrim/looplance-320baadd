# Refatoração da Lógica de Autenticação e Proteção de Rotas

Para resolver o loop de redirecionamento e o "flicker" no login, vou implementar uma gestão de estado de autenticação robusta usando um provedor de contexto e integrando-o com o TanStack Router.

## 1. Criação do AuthProvider
Vou criar um novo componente `AuthProvider` que:
- Gerencia os estados `user`, `session` e `isLoading`.
- Escuta o evento `onAuthStateChange` do Supabase.
- Garante que a aplicação só renderize o conteúdo após a verificação inicial da sessão.

## 2. Atualização do Router Context
Vou modificar o `src/router.tsx` e o `src/routes/__root.tsx` para incluir o estado de autenticação no contexto do roteador. Isso permitirá que as rotas acessem o status de carregamento e o usuário atual de forma síncrona durante as transições de rota.

## 3. Proteção de Rotas com Loading State
Vou ajustar o `beforeLoad` no `__root.tsx` para:
- Aguardar a conclusão do carregamento inicial antes de tomar decisões de redirecionamento.
- Mostrar um componente de "Loading" global enquanto a sessão está sendo recuperada.

## 4. Correção da Lógica de Perfil
- Remover a lógica redundante de verificação de perfil no `Home`.
- Ajustar a verificação de perfil no `beforeLoad` para ser mais resiliente a falhas temporárias de rede ou RLS.
- Garantir que erros de busca de perfil não resultem em logout automático.

## 5. SQL para RLS (Row Level Security)
Vou fornecer o comando SQL para garantir que as políticas de RLS para a tabela `profiles` estejam 100% corretas, permitindo que usuários gerenciem seus próprios dados.

---

### Detalhes Técnicos
- **Estado de Carregamento**: Implementação de um `AuthContext` que expõe `isCheckingAuth`.
- **TanStack Router**: Uso de `context` no roteador para passar o estado de auth para o `beforeLoad`.
- **Resiliência**: Tratamento de erros silencioso em buscas de metadados de perfil para evitar expulsões desnecessárias.
- **RLS**: Garantir políticas de `SELECT`, `UPDATE` e `INSERT` para `profiles` usando `auth.uid() = id`.
