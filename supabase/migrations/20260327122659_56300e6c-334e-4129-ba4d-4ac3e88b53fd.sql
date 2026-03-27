
insert into storage.buckets (id, name, public) values ('orcamentos', 'orcamentos', true);

create policy "Anyone can upload orcamentos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'orcamentos');
create policy "Anyone can read orcamentos" on storage.objects for select to anon, authenticated using (bucket_id = 'orcamentos');
