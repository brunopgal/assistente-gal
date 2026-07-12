-- Cleanup allowlist to keep only the authorized email
DELETE FROM public.usuarios_autorizados
WHERE lower(email) <> 'bruno@painel.local';
