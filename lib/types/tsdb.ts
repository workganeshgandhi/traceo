export enum TSDB {
    INFLUX = "influx",
    INFLUX2 = "influx2",
    PROMETHEUS = "prometheus"
}

export enum CONNECTION_STATUS {
    CONNECTED = "connected",
    FAILED = "failed"
}

export interface DataSourceConnStatus {
    status: CONNECTION_STATUS;
    error: string;
}

export interface MetricsResponse {
    cpuUsage: number;
    memoryUsage: number;
    time: string;
}

export interface MetricsQueryDto {
    id: number;
    hrCount: number;
}