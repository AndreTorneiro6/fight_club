
-- ROLES
create type public.app_role as enum ('admin','player');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- DIVISIONS
create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  tier int not null,
  max_players int not null default 16,
  created_at timestamptz default now()
);
grant select on public.divisions to authenticated;
grant insert, update, delete on public.divisions to authenticated;
grant all on public.divisions to service_role;
alter table public.divisions enable row level security;
create policy "read divisions" on public.divisions for select to authenticated using (true);
create policy "admin divisions" on public.divisions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- SEASONS (structure for later phases)
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date, ends_on date,
  status text not null default 'active',
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.seasons to authenticated;
grant all on public.seasons to service_role;
alter table public.seasons enable row level security;
create policy "read seasons" on public.seasons for select to authenticated using (true);
create policy "admin seasons" on public.seasons for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- PLAYERS
create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  player_number serial,
  name text not null,
  email text,
  phone text,
  avatar_url text,
  partner_name text,
  division_id uuid references public.divisions(id) not null,
  position int not null,
  previous_position int,
  status text not null default 'active',
  wins int not null default 0,
  losses int not null default 0,
  challenges_won int not null default 0,
  challenges_lost int not null default 0,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.players to authenticated;
grant all on public.players to service_role;
alter table public.players enable row level security;
create policy "read players" on public.players for select to authenticated using (true);
create policy "admin players" on public.players for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.my_player_id() returns uuid language sql stable security definer set search_path=public as $$
  select id from public.players where user_id = auth.uid()
$$;

-- SETTINGS (single row)
create table public.league_settings (
  id int primary key default 1 check (id = 1),
  max_positions_above int not null default 3,
  max_active_challenges int not null default 1,
  min_days_between int not null default 0,
  accept_hours int not null default 72,
  schedule_days int not null default 7,
  play_days int not null default 14,
  ranking_model text not null default 'swap',
  refusal_rule text not null default 'none',
  match_minutes int not null default 90,
  slot_minutes int not null default 30,
  promote_count int not null default 3,
  relegate_count int not null default 3,
  updated_at timestamptz default now()
);
grant select, update on public.league_settings to authenticated;
grant all on public.league_settings to service_role;
alter table public.league_settings enable row level security;
create policy "read settings" on public.league_settings for select to authenticated using (true);
create policy "admin settings" on public.league_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- COURTS
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  external_ref text,
  active boolean not null default true
);
grant select, insert, update, delete on public.courts to authenticated;
grant all on public.courts to service_role;
alter table public.courts enable row level security;
create policy "read courts" on public.courts for select to authenticated using (true);
create policy "admin courts" on public.courts for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- CHALLENGES (one challenge = one match)
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  number serial,
  division_id uuid references public.divisions(id) not null,
  challenger_id uuid references public.players(id) not null,
  defender_id uuid references public.players(id) not null,
  challenger_pos int not null,
  defender_pos int not null,
  status text not null default 'pending',
  respond_by timestamptz not null,
  schedule_by timestamptz not null,
  play_by timestamptz not null,
  refuse_reason text,
  refuse_note text,
  scheduled_at timestamptz,
  court_id uuid references public.courts(id),
  duration_minutes int,
  winner_id uuid references public.players(id),
  score text,
  reported_by uuid references public.players(id),
  dispute_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.challenges to authenticated;
grant all on public.challenges to service_role;
alter table public.challenges enable row level security;
create policy "read challenges" on public.challenges for select to authenticated using (true);
create policy "admin challenges" on public.challenges for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.challenge_slots (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges(id) on delete cascade not null,
  player_id uuid references public.players(id) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz default now()
);
grant select, insert, delete on public.challenge_slots to authenticated;
grant all on public.challenge_slots to service_role;
alter table public.challenge_slots enable row level security;
create policy "read slots" on public.challenge_slots for select to authenticated using (true);

create table public.challenge_messages (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges(id) on delete cascade not null,
  player_id uuid references public.players(id),
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz default now()
);
grant select, insert on public.challenge_messages to authenticated;
grant all on public.challenge_messages to service_role;
alter table public.challenge_messages enable row level security;
create policy "read msgs" on public.challenge_messages for select to authenticated using (
  public.has_role(auth.uid(),'admin') or exists(select 1 from public.challenges c where c.id=challenge_id and public.my_player_id() in (c.challenger_id,c.defender_id)));
create policy "send msgs" on public.challenge_messages for insert to authenticated with check (
  player_id = public.my_player_id() and exists(select 1 from public.challenges c where c.id=challenge_id and public.my_player_id() in (c.challenger_id,c.defender_id)));

-- AVAILABILITY
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete cascade not null,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null
);
grant select, insert, update, delete on public.availability to authenticated;
grant all on public.availability to service_role;
alter table public.availability enable row level security;
create policy "read avail" on public.availability for select to authenticated using (true);
create policy "own avail" on public.availability for all to authenticated using (player_id = public.my_player_id()) with check (player_id = public.my_player_id());

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete cascade not null,
  from_date date not null,
  to_date date not null,
  note text
);
grant select, insert, update, delete on public.availability_exceptions to authenticated;
grant all on public.availability_exceptions to service_role;
alter table public.availability_exceptions enable row level security;
create policy "read exc" on public.availability_exceptions for select to authenticated using (true);
create policy "own exc" on public.availability_exceptions for all to authenticated using (player_id = public.my_player_id()) with check (player_id = public.my_player_id());

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  challenge_id uuid references public.challenges(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notif" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notif upd" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notif del" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- AUDIT
create table public.ranking_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete cascade not null,
  division_id uuid references public.divisions(id),
  old_position int, new_position int,
  reason text,
  challenge_id uuid references public.challenges(id) on delete set null,
  created_at timestamptz default now()
);
grant select on public.ranking_history to authenticated;
grant all on public.ranking_history to service_role;
alter table public.ranking_history enable row level security;
create policy "read rh" on public.ranking_history for select to authenticated using (true);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user uuid,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);
grant select on public.admin_actions to authenticated;
grant all on public.admin_actions to service_role;
alter table public.admin_actions enable row level security;
create policy "admin read log" on public.admin_actions for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- HELPERS
create or replace function public._notify_player(_player uuid, _title text, _body text, _ch uuid)
returns void language plpgsql security definer set search_path=public as $$
declare u uuid; begin
  select user_id into u from players where id=_player;
  if u is not null then insert into notifications(user_id,title,body,challenge_id) values(u,_title,_body,_ch); end if;
end $$;

create or replace function public._notify_admins(_title text, _body text, _ch uuid)
returns void language sql security definer set search_path=public as $$
  insert into notifications(user_id,title,body,challenge_id)
  select user_id,_title,_body,_ch from user_roles where role='admin';
$$;

create or replace function public._log(_action text, _details jsonb)
returns void language sql security definer set search_path=public as $$
  insert into admin_actions(admin_user,action,details) values(auth.uid(),_action,_details);
$$;

create or replace function public._is_participant(_c challenges) returns boolean language sql stable security definer set search_path=public as $$
  select public.my_player_id() in (_c.challenger_id,_c.defender_id)
$$;

-- Apply result & ranking movement (configurable model)
create or replace function public._apply_result(_cid uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges; s league_settings; w players; l players; loser uuid;
begin
  select * into c from challenges where id=_cid;
  select * into s from league_settings where id=1;
  loser := case when c.winner_id=c.challenger_id then c.defender_id else c.challenger_id end;
  select * into w from players where id=c.winner_id;
  select * into l from players where id=loser;
  update players set wins=wins+1, challenges_won=challenges_won+1 where id=w.id;
  update players set losses=losses+1, challenges_lost=challenges_lost+1 where id=l.id;
  if s.ranking_model='swap' and w.id=c.challenger_id and w.position > l.position then
    update players set previous_position=position, position=l.position where id=w.id;
    update players set previous_position=position, position=w.position where id=l.id;
    insert into ranking_history(player_id,division_id,old_position,new_position,reason,challenge_id)
      values (w.id,w.division_id,w.position,l.position,'Vitória em desafio',c.id),
             (l.id,l.division_id,l.position,w.position,'Derrota em desafio',c.id);
  elsif s.ranking_model='leapfrog' and w.id=c.challenger_id and w.position > l.position then
    update players set previous_position=position, position=position+1
      where division_id=w.division_id and position >= l.position and position < w.position;
    update players set previous_position=w.position, position=l.position where id=w.id;
    insert into ranking_history(player_id,division_id,old_position,new_position,reason,challenge_id)
      values (w.id,w.division_id,w.position,l.position,'Vitória em desafio',c.id);
  else
    update players set previous_position=position where id in (w.id,l.id);
  end if;
  update challenges set status='completed', completed_at=now() where id=_cid;
  perform _notify_player(w.id,'🏆 Resultado confirmado','Vitória registada. Ranking atualizado.',c.id);
  perform _notify_player(l.id,'Resultado confirmado','O ranking foi atualizado.',c.id);
end $$;

-- PLAYER RPCs
create or replace function public.create_challenge(_defender uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare me players; d players; s league_settings; cid uuid; n int; last timestamptz;
begin
  select * into me from players where id=my_player_id();
  if me.id is null then raise exception 'Sem perfil de jogador'; end if;
  if me.status<>'active' then raise exception 'Jogador inativo'; end if;
  select * into d from players where id=_defender;
  if d.id is null or d.status<>'active' then raise exception 'Adversário indisponível'; end if;
  if d.division_id<>me.division_id then raise exception 'Só podes desafiar na tua divisão'; end if;
  select * into s from league_settings where id=1;
  if not (d.position < me.position and me.position - d.position <= s.max_positions_above) then
    raise exception 'Fora das regras: só podes desafiar até % posições acima', s.max_positions_above; end if;
  select count(*) into n from challenges where status in ('pending','accepted','scheduled','result_pending','disputed') and me.id in (challenger_id,defender_id);
  if n >= s.max_active_challenges then raise exception 'Atingiste o máximo de desafios simultâneos (%)', s.max_active_challenges; end if;
  select count(*) into n from challenges where status in ('pending','accepted','scheduled','result_pending','disputed') and d.id in (challenger_id,defender_id);
  if n >= s.max_active_challenges then raise exception 'Este jogador já tem desafios ativos'; end if;
  select max(created_at) into last from challenges where challenger_id=me.id;
  if last is not null and last > now() - make_interval(days => s.min_days_between) then
    raise exception 'Tens de esperar % dias entre desafios', s.min_days_between; end if;
  insert into challenges(division_id,challenger_id,defender_id,challenger_pos,defender_pos,respond_by,schedule_by,play_by)
  values(me.division_id,me.id,d.id,me.position,d.position, now()+make_interval(hours=>s.accept_hours), now()+make_interval(days=>s.schedule_days), now()+make_interval(days=>s.play_days))
  returning id into cid;
  perform _notify_player(d.id,'🥊 '||me.name||' (#'||me.position||') desafiou-te.','Aceita ou recusa o desafio.',cid);
  return cid;
end $$;

create or replace function public.respond_challenge(_id uuid, _accept boolean, _reason text default null, _note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges; s league_settings; dn text;
begin
  select * into c from challenges where id=_id for update;
  if c.status<>'pending' then raise exception 'Desafio já não está pendente'; end if;
  if not (my_player_id()=c.defender_id or has_role(auth.uid(),'admin')) then raise exception 'Sem permissão'; end if;
  select name into dn from players where id=c.defender_id;
  if _accept then
    update challenges set status='accepted' where id=_id;
    perform _notify_player(c.challenger_id,'✅ '||dn||' aceitou o teu desafio','Indica as tuas disponibilidades.',_id);
    perform _notify_player(c.defender_id,'📅 Indica a tua disponibilidade','Para marcar o jogo.',_id);
  else
    if _reason is null then raise exception 'Indica o motivo'; end if;
    update challenges set status='refused', refuse_reason=_reason, refuse_note=_note where id=_id;
    perform _notify_player(c.challenger_id,'❌ '||dn||' recusou o desafio','Motivo: '||_reason,_id);
    perform _notify_admins('Desafio recusado',dn||' recusou ('||_reason||')',_id);
    select * into s from league_settings where id=1;
    if s.refusal_rule='forfeit' and _reason not in ('Lesão') then
      update challenges set winner_id=c.challenger_id where id=_id;
      perform _apply_result(_id);
    end if;
  end if;
end $$;

create or replace function public.add_slot(_challenge uuid, _start timestamptz, _end timestamptz, _player uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges; p uuid;
begin
  select * into c from challenges where id=_challenge;
  if c.status not in ('accepted') then raise exception 'Desafio não está em marcação'; end if;
  p := coalesce(_player, my_player_id());
  if p not in (c.challenger_id,c.defender_id) then raise exception 'Jogador inválido'; end if;
  if p<>my_player_id() and not has_role(auth.uid(),'admin') then raise exception 'Sem permissão'; end if;
  if _end <= _start then raise exception 'Hora final inválida'; end if;
  insert into challenge_slots(challenge_id,player_id,starts_at,ends_at) values(_challenge,p,_start,_end);
  perform _notify_player(case when p=c.challenger_id then c.defender_id else c.challenger_id end,'📅 Nova disponibilidade','O adversário indicou horários. Vê os compatíveis.',_challenge);
end $$;

create or replace function public.delete_slot(_slot uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from challenge_slots where id=_slot and (player_id=my_player_id() or has_role(auth.uid(),'admin'));
end $$;

create or replace function public.schedule_challenge(_id uuid, _start timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges; s league_settings; e timestamptz;
begin
  select * into c from challenges where id=_id for update;
  if c.status<>'accepted' then raise exception 'Desafio não está em marcação'; end if;
  if not (_is_participant(c) or has_role(auth.uid(),'admin')) then raise exception 'Sem permissão'; end if;
  select * into s from league_settings where id=1;
  e := _start + make_interval(mins=>s.match_minutes);
  if not has_role(auth.uid(),'admin') then
    if not exists(select 1 from challenge_slots where challenge_id=_id and player_id=c.challenger_id and starts_at<=_start and ends_at>=e)
      or not exists(select 1 from challenge_slots where challenge_id=_id and player_id=c.defender_id and starts_at<=_start and ends_at>=e)
    then raise exception 'Horário não é compatível para ambos'; end if;
  end if;
  update challenges set status='scheduled', scheduled_at=_start, duration_minutes=s.match_minutes where id=_id;
  perform _notify_player(c.challenger_id,'✅ Jogo marcado',to_char(_start at time zone 'Europe/Lisbon','DD/MM HH24:MI'),_id);
  perform _notify_player(c.defender_id,'✅ Jogo marcado',to_char(_start at time zone 'Europe/Lisbon','DD/MM HH24:MI'),_id);
end $$;

create or replace function public.report_result(_id uuid, _winner uuid, _score text default null)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges; me uuid;
begin
  select * into c from challenges where id=_id for update;
  if c.status not in ('scheduled','accepted') then raise exception 'Não é possível registar resultado agora'; end if;
  me := my_player_id();
  if me not in (c.challenger_id,c.defender_id) then raise exception 'Sem permissão'; end if;
  if _winner not in (c.challenger_id,c.defender_id) then raise exception 'Vencedor inválido'; end if;
  update challenges set status='result_pending', winner_id=_winner, score=nullif(trim(_score),''), reported_by=me where id=_id;
  perform _notify_player(case when me=c.challenger_id then c.defender_id else c.challenger_id end,'Confirma o resultado deste jogo','Confirma ou contesta.',_id);
end $$;

create or replace function public.confirm_result(_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges;
begin
  select * into c from challenges where id=_id for update;
  if c.status<>'result_pending' then raise exception 'Nada a confirmar'; end if;
  if not ((_is_participant(c) and my_player_id()<>c.reported_by) or has_role(auth.uid(),'admin')) then raise exception 'Sem permissão'; end if;
  perform _apply_result(_id);
end $$;

create or replace function public.dispute_result(_id uuid, _note text)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges;
begin
  select * into c from challenges where id=_id for update;
  if c.status<>'result_pending' then raise exception 'Nada a contestar'; end if;
  if not (_is_participant(c) and my_player_id()<>c.reported_by) then raise exception 'Sem permissão'; end if;
  update challenges set status='disputed', dispute_note=_note where id=_id;
  perform _notify_admins('⚠️ Resultado contestado','Desafio #'||c.number,_id);
  perform _notify_player(c.reported_by,'⚠️ Resultado contestado','O administrador vai analisar.',_id);
end $$;

-- ADMIN RPCs
create or replace function public.admin_resolve(_id uuid, _action text, _winner uuid default null, _score text default null)
returns void language plpgsql security definer set search_path=public as $$
declare c challenges;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Apenas administrador'; end if;
  select * into c from challenges where id=_id for update;
  if _action='winner' then
    if c.status='completed' then raise exception 'Já concluído'; end if;
    update challenges set winner_id=_winner, score=coalesce(_score,score) where id=_id;
    perform _apply_result(_id);
  elsif _action='void' then update challenges set status='cancelled' where id=_id;
  elsif _action='replay' then update challenges set status='accepted', winner_id=null, reported_by=null, scheduled_at=null where id=_id;
  elsif _action='extend' then update challenges set play_by=play_by+interval '7 days', respond_by=greatest(respond_by,now())+interval '2 days', status=case when status='expired' then 'pending' else status end where id=_id;
  else raise exception 'Ação inválida'; end if;
  perform _log('challenge_'||_action, jsonb_build_object('challenge',_id,'winner',_winner));
end $$;

create or replace function public.admin_set_court(_id uuid, _court uuid, _start timestamptz, _minutes int)
returns void language plpgsql security definer set search_path=public as $$
declare e timestamptz;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Apenas administrador'; end if;
  e := _start + make_interval(mins=>_minutes);
  if exists(select 1 from challenges where court_id=_court and id<>_id and status in ('scheduled','result_pending')
     and scheduled_at < e and scheduled_at + make_interval(mins=>coalesce(duration_minutes,90)) > _start)
  then raise exception 'Conflito: o campo já está ocupado nesse horário'; end if;
  update challenges set court_id=_court, scheduled_at=_start, duration_minutes=_minutes,
    status=case when status in ('accepted','pending') then 'scheduled' else status end where id=_id;
  perform _log('set_court', jsonb_build_object('challenge',_id,'court',_court,'start',_start));
end $$;

create or replace function public.admin_set_position(_player uuid, _pos int)
returns void language plpgsql security definer set search_path=public as $$
declare p players;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Apenas administrador'; end if;
  select * into p from players where id=_player;
  if _pos < p.position then
    update players set previous_position=position, position=position+1 where division_id=p.division_id and position>=_pos and position<p.position;
  elsif _pos > p.position then
    update players set previous_position=position, position=position-1 where division_id=p.division_id and position<=_pos and position>p.position;
  end if;
  update players set previous_position=p.position, position=_pos where id=_player;
  insert into ranking_history(player_id,division_id,old_position,new_position,reason) values(_player,p.division_id,p.position,_pos,'Alteração do administrador');
  perform _log('set_position', jsonb_build_object('player',_player,'from',p.position,'to',_pos));
end $$;

create or replace function public.admin_move_division(_player uuid, _division uuid)
returns void language plpgsql security definer set search_path=public as $$
declare p players; np int;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Apenas administrador'; end if;
  select * into p from players where id=_player;
  update players set position=position-1 where division_id=p.division_id and position>p.position;
  select coalesce(max(position),0)+1 into np from players where division_id=_division;
  update players set division_id=_division, previous_position=null, position=np where id=_player;
  perform _log('move_division', jsonb_build_object('player',_player,'from',p.division_id,'to',_division));
end $$;

create or replace function public.update_my_profile(_name text, _phone text, _partner text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update players set name=coalesce(nullif(trim(_name),''),name), phone=_phone, partner_name=_partner where user_id=auth.uid();
end $$;

-- SIGNUP: link to existing player by email, else create in lowest division; first user = admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare pid uuid; div uuid; np int;
begin
  select id into pid from players where lower(email)=lower(new.email) and user_id is null limit 1;
  if pid is not null then
    update players set user_id=new.id where id=pid;
  else
    select id into div from divisions order by tier desc limit 1;
    select coalesce(max(position),0)+1 into np from players where division_id=div;
    insert into players(user_id,name,email,division_id,position)
      values(new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, div, np);
  end if;
  insert into user_roles(user_id,role) values(new.id,'player') on conflict do nothing;
  if not exists(select 1 from user_roles where role='admin') then
    insert into user_roles(user_id,role) values(new.id,'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

revoke execute on function public._apply_result(uuid), public._notify_player(uuid,text,text,uuid), public._notify_admins(text,text,uuid), public._log(text,jsonb) from public, anon, authenticated;

-- SEED
insert into league_settings(id) values(1);
insert into divisions(code,name,tier,max_players) values('ouro','Ouro',1,8),('prata','Prata',2,8),('bronze','Bronze',3,12);
insert into seasons(name,starts_on,ends_on,status) values('Season 1','2026-05-01','2026-10-31','active');
insert into courts(name) values('Campo 1'),('Campo 2'),('Campo 3'),('Campo 4');

insert into players(name,email,division_id,position,previous_position,wins,losses)
select v.name, v.email, (select id from divisions where code=v.div), v.pos, v.prev, v.w, v.l from (values
 ('João Silva','joao.demo@fightclub.test','ouro',1,1,12,2),
 ('Pedro Costa','pedro.demo@fightclub.test','ouro',2,3,11,3),
 ('Rui Santos','rui.demo@fightclub.test','ouro',3,2,10,4),
 ('Tiago Oliveira','tiago.demo@fightclub.test','ouro',4,4,9,5),
 ('Luís Costa','luis.demo@fightclub.test','ouro',5,6,8,6),
 ('Bruno Martins','bruno.demo@fightclub.test','ouro',6,5,7,7),
 ('Carlos Pereira','carlos.demo@fightclub.test','ouro',7,8,5,8),
 ('Miguel Silva','miguel.demo@fightclub.test','ouro',8,7,4,9),
 ('André Sousa','andre.demo@fightclub.test','prata',1,1,9,3),
 ('Diogo Alves','diogo.demo@fightclub.test','prata',2,4,8,4),
 ('Ricardo Lopes','ricardo.demo@fightclub.test','prata',3,2,7,5),
 ('Filipe Ramos','filipe.demo@fightclub.test','prata',4,3,6,6),
 ('Hugo Teixeira','hugo.demo@fightclub.test','prata',5,5,4,7),
 ('Nuno Ferreira','nuno.demo@fightclub.test','prata',6,6,3,8),
 ('Gonçalo Pinto','goncalo.demo@fightclub.test','bronze',1,2,7,2),
 ('Vasco Mendes','vasco.demo@fightclub.test','bronze',2,1,6,3),
 ('Rafael Cunha','rafael.demo@fightclub.test','bronze',3,3,5,4),
 ('Sérgio Rocha','sergio.demo@fightclub.test','bronze',4,5,3,5),
 ('Duarte Lima','duarte.demo@fightclub.test','bronze',5,4,2,6),
 ('Marco Faria','marco.demo@fightclub.test','bronze',6,6,1,6)
) as v(name,email,div,pos,prev,w,l);
