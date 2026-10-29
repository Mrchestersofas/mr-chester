-- Ventas en vivo: que el dashboard y el TV se enteren al instante de ventas, leads, cotizaciones y WhatsApp.
do $$
declare t text;
begin
  foreach t in array array['pedidos', 'crm_prospectos', 'cotizaciones', 'wa_mensajes'] loop
    begin execute format('alter publication supabase_realtime add table %I', t); exception when duplicate_object then null; end;
  end loop;
end $$;
