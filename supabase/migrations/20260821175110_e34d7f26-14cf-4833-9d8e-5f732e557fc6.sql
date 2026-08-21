-- 1. Corrigir avisos de segurança do linter para has_role
-- Revogar execução pública e permitir apenas para funções de serviço (authenticated já tem acesso controlado pela política, mas a função em si é SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2. Configurar RLS para o bucket whatsapp-media
-- Nota: Supabase storage usa a tabela storage.objects para RLS
CREATE POLICY "Admins can manage storage objects"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'whatsapp-media' AND 
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Revisors can read storage objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'whatsapp-media' AND 
  public.has_role(auth.uid(), 'revisor')
);
