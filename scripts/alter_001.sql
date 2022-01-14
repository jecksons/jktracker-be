create table user
(
   id_user int not null auto_increment,
   description varchar(100) not null,
   email varchar(200),
   constraint pk_user primary key(id_user)
);

alter table task add id_user int;

alter table task add constraint fk_task_id_user foreign key(id_user)
references user(id_user) on delete cascade;

insert into user
(
   description
)
values
(
   'Demo user'
);

update task
set id_user = (select max(usu.id_user) from user usu)
where id_user is null;

commit;

create table refresh_token
(
   token varchar(200) not null,
   id_user int not null,
   expire_date datetime not null,
   created_at datetime,
   constraint pk_refresh_token primary key(token)
);

alter table refresh_token add constraint fk_refresh_token_id_user
foreign key(id_user) references user(id_user) on delete cascade;