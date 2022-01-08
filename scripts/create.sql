create table task_status
(
   id_task_status varchar(1) not null,
   description varchar(100) not null,
   constraint pk_task_status primary key(id_task_status)
);

insert into task_status values('O', 'Opened');

insert into task_status values('C', 'Cancelled');

insert into task_status values('F', 'Finished');

create table task
(
   id_task int not null auto_increment,
   description varchar(500) not null,
   id_task_parent int,
   id_task_status varchar(1) not null,
   due_date datetime,
   priority int,
   estimated_time float,
   constraint pk_task primary key(id_task)
);

alter table task add constraint fk_task_task_status foreign key(id_task_status) references task_status(id_task_status);

create table task_time_track
(
   id_task_time_track int not null auto_increment,
   id_task int not null,
   start_time datetime not null,
   end_time datetime,
   constraint pk_task_time_track primary key(id_task_time_track)
);

alter table task_time_track add constraint fk_task_time_track_tsk foreign key(id_task) references task(id_task) on delete cascade;