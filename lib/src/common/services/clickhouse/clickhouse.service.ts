import { Injectable } from "@nestjs/common";
import { ClickHouseClient, ClickHouseClientConfigOptions, createClient, QueryParams } from "@clickhouse/client";
import { ILog, PerformanceQuery, Performance, Notification, Span } from "@traceo/types";
import { ExploreMetricsQueryDto } from "../../../common/types/dto/metrics.dto";
import { QueryTracingDto } from "../../../common/types/dto/tracing";
import { LogsQuery } from "../../../common/types/dto/logs.dto";
import { AggregateTimeSeries } from "../../../api/metrics/query/metrics-query.service";

@Injectable()
export class ClickhouseService {
    private readonly configs: ClickHouseClientConfigOptions;
    private client: ClickHouseClient;

    constructor(configs: ClickHouseClientConfigOptions) {
        this.configs = configs;
    }

    public async connect() {
        this.client = createClient(this.configs);
    }

    public async query(params: QueryParams) {
        return await this.client.query(params)
    }

    public async rawDataMetrics(
        projectId: string,
        query: ExploreMetricsQueryDto
    ): Promise<any> {
        let queryFilters: string[] = [];

        for (const field of query.fields) {
            queryFilters.push(`arrayFilter(x -> x IS NOT NULL, groupArray(if(name = '${field}', round(value, 2), NULL)))[1] AS ${field}\n`);
        };

        const seriesFields = query.fields.map((e) => `'${e}'`).join(", ");

        const sqlQuery = `
            SELECT
                minute,
                ${queryFilters.join(",")}
            FROM (
                SELECT
                    toUnixTimestamp(toStartOfInterval(toDateTime(receive_timestamp), INTERVAL 1 MINUTE)) AS minute,
                    name,
                    AVG(value) AS value
                FROM traceo_development.metrics
                WHERE
                    receive_timestamp >= toUnixTimestamp(toDateTime(${query.from}))
                    AND receive_timestamp <= toUnixTimestamp(toDateTime(${query.to}))
                    AND name IN [${seriesFields}]
                    AND project_id = '${projectId}'
                GROUP BY minute, name
            )
            GROUP BY minute
            ORDER BY minute ASC
            WITH FILL FROM toUnixTimestamp(toStartOfMinute(toDateTime(${query.from}))) TO toUnixTimestamp(toStartOfMinute(toDateTime(${query.to})))
            STEP ${query.interval * 60}
        `;

        const logs = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return logs.json();
    }

    public async aggregateMetrics(
        projectId: string,
        name: string,
        query: ExploreMetricsQueryDto
    ): Promise<AggregateTimeSeries> {
        /**
         * TIPS: 
         * - Use HAVING instead of WHERE in aggregated queries
         * - When HAVING is used then GROUP BY should be before this clause.
         */
        const sqlQuery = `
            SELECT
                toUnixTimestamp(toStartOfInterval(toDateTime(receive_timestamp), INTERVAL ${query.interval} MINUTE)) as minute,
                round(AVG(value), 2) as value
            FROM metrics
            WHERE
                receive_timestamp >= toUnixTimestamp(toDateTime(${query.from}))
                AND receive_timestamp <= toUnixTimestamp(toDateTime(${query.to}))
                AND name = '${name}'
                AND project_id = '${projectId}'
            GROUP BY minute
            HAVING ${query.valueMax ? `value <= ${query.valueMax}` : '1=1'} AND ${query.valueMin ? `value >= ${query.valueMin}` : '1=1'}
            ORDER BY minute ASC
            WITH FILL FROM toUnixTimestamp(toStartOfMinute(toDateTime(${query.from}))) TO toUnixTimestamp(toStartOfMinute(toDateTime(${query.to})))
            STEP ${query.interval * 60}
        `;

        const logs = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return logs.json();
    }

    public async loadMetricsFields(projectId: string): Promise<{ name: string }[]> {
        const sqlQuery = `
            SELECT DISTINCT name
            FROM metrics
            WHERE project_id = '${projectId}'
            ORDER BY name ASC
        `;

        const fields = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return fields.json();
    }

    public async loadLogs(fields: string[] = ["*"], query: LogsQuery): Promise<ILog[]> {
        const selectedFields = fields.length > 0 ? fields.join(", ") : fields[0];

        let sqlQuery = `
            SELECT ${selectedFields} FROM logs 
            WHERE project_id = '${query.projectId}'
            AND receive_timestamp >= ${query.from}
            AND receive_timestamp <= ${query.to}
        `;

        const search = query?.search;
        if (search) {
            sqlQuery += `AND LOWER(message) LIKE '%${search.toLowerCase()}%'\n`;
        }

        sqlQuery += 'ORDER BY precise_timestamp DESC\n';

        let limit = query.take ?? 1000;
        if (limit && limit > 1000) {
            limit = 2000;
        }
        sqlQuery += `LIMIT ${limit}`;

        const logs = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return logs.json<ILog[]>();
    };

    /**
     * 
     * Clickhouse aggregate query to return time series 
     * response with minute and count as interval between two unix's.
     * 
     * TODO: add mapping to return values in [[minute, count]] format.
     * 
     * @param query 
     * @param interval in seconds
     */
    public async loadLogsTimeSeries(query: LogsQuery, interval: number): Promise<{ minute: number, count: number }[]> {
        const sqlQuery = `
            SELECT
                toUnixTimestamp(toStartOfInterval(toDateTime(receive_timestamp), INTERVAL 1 MINUTE)) as minute,
                COUNT(*) as count
            FROM logs
            WHERE 
                receive_timestamp >= toUnixTimestamp(toDateTime(${query.from})) 
            AND 
                receive_timestamp <= toUnixTimestamp(toDateTime(${query.to}))
            ${query.search ? `AND LOWER(message) LIKE '%${query.search?.toLowerCase() ?? ''}%'` : ''}
            GROUP BY minute
            ORDER BY minute ASC
            WITH FILL FROM toUnixTimestamp(toStartOfMinute(toDateTime(${query.from})))
                      TO toUnixTimestamp(toStartOfMinute(toDateTime(${query.to})))
            STEP ${interval}
        `;

        const logs = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return logs.json();
    }

    public async loadPermormance(projectId: string, query: PerformanceQuery): Promise<Performance[]> {
        const from = query.from;
        const to = query.to;
        const names = query.fields.map((e) => `'${e}'`);
        const healths = query.health ? `'${query.health}'` : `'good', 'need_improvement', 'poor'`;

        let sqlQuery = `
        SELECT * FROM performance
            WHERE project_id = '${projectId}'
            AND timestamp >= ${from}
            AND timestamp <= ${to}
            AND name in (${names})
            AND health in (${healths})
        `;

        if (query.search) {
            const search = query.search.toLowerCase();
            sqlQuery += `AND(multiSearchAny(lower(browser_name), ['${search}'])`;
            sqlQuery += `OR multiSearchAny(lower(platform_type), ['${search}'])`;
            sqlQuery += `OR multiSearchAny(lower(view), ['${search}']))`;
        }

        sqlQuery += 'ORDER BY receive_timestamp DESC';

        const perfs = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return perfs.json<Performance[]>();
    }

    public async loadUserNotifications(userId: string): Promise<Notification[]> {
        const sqlQuery = `
        SELECT * FROM notifications WHERE user_id = '${userId}'
            ORDER BY timestamp DESC
            `;

        const notifications = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return notifications.json<Notification[]>();
    }

    public async loadTracingServiceNames(projectId: string): Promise<{ service_name: string }[]> {
        const sqlQuery = `
            SELECT DISTINCT service_name
            FROM tracing
            WHERE project_id = '${projectId}'
            AND parent_span_id = ''
            `;

        const serviceNames = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return serviceNames.json();
    }

    public async loadSpansNames(projectId: string): Promise<{ name: string }[]> {
        const sqlQuery = `
            SELECT DISTINCT name
            FROM tracing
            WHERE project_id = '${projectId}'
            AND parent_span_id = ''
            `;

        const serviceNames = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        return serviceNames.json();
    }

    public async loadRootTraces(query: QueryTracingDto): Promise<Span[]> {
        let sqlQuery = `
        SELECT * FROM tracing
            WHERE project_id = '${query.projectId}'
            AND parent_span_id = ''
            AND toDateTime(receive_timestamp) > toDateTime(${query.from})
            AND toDateTime(receive_timestamp) < toDateTime(${query.to})
            `;

        if (query?.serviceName) {
            sqlQuery += `AND service_name = '${query.serviceName}'\n`
        }

        if (query?.spanName) {
            sqlQuery += `AND name = '${query.spanName}'\n`
        }

        if (query?.traceStatus) {
            sqlQuery += `AND status = '${query.traceStatus}'\n`
        }

        if (query?.traceKind) {
            sqlQuery += `AND kind = ${query.traceKind} \n`
        }

        if (query?.durationMax) {
            sqlQuery += `AND duration <= ${query.durationMax} \n`
        }

        if (query?.durationMin) {
            sqlQuery += `AND duration => ${query.durationMin} \n`
        }

        const search = query?.search;
        if (search) {
            sqlQuery += `AND(multiSearchAny(lower(trace_id), ['${search}'])`;
            sqlQuery += `OR multiSearchAny(lower(span_id), ['${search}'])`;
            sqlQuery += `OR multiSearchAny(lower(service_name), ['${search}'])`;
            sqlQuery += `OR multiSearchAny(lower(name), ['${search}']))`;
        }

        sqlQuery += 'ORDER BY receive_timestamp DESC\n';
        sqlQuery += `LIMIT ${query?.take || 100} `;

        const spans = await this.query({
            query: sqlQuery,
            format: "JSONEachRow"
        });

        const resp = await spans.json<Span[]>();
        return resp;
    }
}