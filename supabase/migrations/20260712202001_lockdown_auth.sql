-- 1. Excluir o usuário de teste do auth.users
DELETE FROM auth.users WHERE email = 'test-antigravity@gallo.com';

-- 2. Criar função e trigger de proteção de signup no auth.users (segura contra search_path hijacking)
CREATE OR REPLACE FUNCTION public.check_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios_autorizados 
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'O e-mail % nao esta autorizado para cadastro.', NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_signup ON auth.users;
CREATE TRIGGER on_auth_user_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_signup();
