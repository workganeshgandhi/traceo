import { Injectable } from '@nestjs/common';
import { BaseDtoQuery } from '../../core/query/generic.model';
import { GenericQueryService } from '../../core/query/generic-query.service';
import { Account } from '../../db/entities/account.entity';
import { EntityManager, SelectQueryBuilder } from 'typeorm';

@Injectable()
export class AccountQueryService extends GenericQueryService<
  Account,
  BaseDtoQuery
> {
  constructor(readonly entityManager: EntityManager) {
    super(entityManager, Account);
  }

  public get builderAlias(): string {
    return 'account';
  }

  public extendQueryBuilder(
    builder: SelectQueryBuilder<Account>,
    query: BaseDtoQuery,
  ): SelectQueryBuilder<Account> {
    const { search } = query;

    if (search) {
      builder
        .where("LOWER(account.name) LIKE LOWER(:name)", { name: `%${search}%` })
        .orWhere("LOWER(account.username) LIKE LOWER(:username)", {
          username: `%${search}%`
        })
        .orWhere("LOWER(account.email) LIKE LOWER(:email)", {
          email: `%${search}%`
        });
    }

    return builder;
  }

  public selectedColumns(): string[] {
    return [
      "id",
      "name",
      "username",
      "email",
      "gravatar",
      "status",
      "isAdmin",
      "isPasswordUpdated",
    ];
  }
}
