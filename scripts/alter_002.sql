create table unique_code
(
    code_string varchar(100) not null,
    constraint pk_unique_code primary key(code_string)
);

alter table task add unique_code varchar(15);

create index idx_task_unique_code on task(unique_code);