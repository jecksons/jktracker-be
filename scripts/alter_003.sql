alter table task add created_at datetime;

alter table task add constraint fk_task_id_parent foreign key(id_task_parent) references task(id_task) on delete cascade;