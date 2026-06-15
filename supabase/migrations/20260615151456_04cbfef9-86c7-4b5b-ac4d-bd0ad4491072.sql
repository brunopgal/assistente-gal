CREATE POLICY "michele uploads read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'michele-uploads');
CREATE POLICY "michele uploads insert auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'michele-uploads');
CREATE POLICY "michele uploads update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'michele-uploads');
CREATE POLICY "michele uploads delete auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'michele-uploads');