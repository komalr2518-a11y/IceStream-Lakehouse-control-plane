# IceStream – Real-Time Lakehouse Observability

## Overview

IceStream is a real-time data engineering project built to monitor streaming data quality before bad data reaches downstream analytics.

The project simulates an e-commerce transaction pipeline where data is generated, streamed through Kafka, processed with Flink, and stored using Apache Iceberg. Data quality checks are applied during the pipeline, and abnormal data can be isolated instead of being allowed to continue into the main dataset.

The project also includes a lineage dashboard to make the movement of data through the pipeline easier to understand and monitor.

---

## Problem

In a traditional batch pipeline, a data issue may not be noticed until the final dashboard or report is affected.

For example, if a large number of transactions suddenly contain missing values or a schema changes unexpectedly, the problem may only become visible after the data has already reached downstream systems.

IceStream is designed around a simpler idea:

**Detect the problem while the data is moving, rather than after it has already caused a problem.**

---

## Architecture

```text
E-Commerce Transactions
          |
          v
Transaction Generator
          |
          v
     Apache Kafka
          |
          v
      Apache Flink
          |
          +--------------------+
          |                    |
          v                    v
     Data Quality          Bad Data /
        Checks              Anomalies
          |                    |
          v                    v
   Apache Iceberg         DLQ / Quarantine
          |
          v
   Downstream Analytics
          |
          v
    Lineage Dashboard
```

The pipeline is designed around three main areas:

* **Streaming** – Kafka and Flink handle incoming transaction data.
* **Lakehouse Storage** – Apache Iceberg is used for the analytical data layer.
* **Observability** – Data quality rules and the React-based lineage view help identify where a problem occurs.

---

## Main Components

### 1. Transaction Generator

A Python-based generator produces mock e-commerce transactions for the streaming pipeline.

The generator can also introduce data issues such as:

* missing values
* unexpected schema changes
* invalid records

This makes it possible to test how the pipeline behaves when bad data enters the system.

### 2. Apache Kafka

Kafka acts as the streaming layer between the transaction generator and the processing system.

It allows transaction events to be published continuously instead of waiting for a batch process.

### 3. Apache Flink

Flink processes the incoming Kafka stream and performs the required streaming operations and data-quality checks.

It is also responsible for identifying abnormal data conditions during processing.

### 4. Apache Iceberg

Iceberg provides the lakehouse table layer where processed data is stored.

The project also uses Iceberg's snapshot and time-travel capabilities to inspect the state of the data before an incident occurred.

### 5. Data Quality / Observability

The pipeline checks incoming data against defined quality rules.

Examples include checking for unexpected NULL values and other data-quality failures.

When the failure rate crosses the configured threshold, the pipeline can stop sending the affected records to the main dataset and route them to a quarantine/DLQ table.

### 6. Lineage Dashboard

The frontend provides a visual representation of the pipeline:

```text
Ingest → Process → Serve
```

The dashboard is intended to make it easier to identify which part of the pipeline is affected when a data-quality issue occurs.

---

## Circuit Breaker

One of the main parts of IceStream is the automated circuit-breaker behavior.

The project uses a defined error threshold. When the error rate crosses the threshold, incoming problematic data is routed away from the main data table and into a Dead Letter Queue (DLQ).

```text
Normal Data
    |
    v
Main Iceberg Table


Bad Data / High Error Rate
    |
    v
Circuit Breaker
    |
    v
DLQ / Quarantine Table
```

This prevents known bad data from continuing through the normal analytical pipeline.

---

## Data Flow

The expected flow is:

1. Mock transactions are generated.
2. Transactions are published to Kafka.
3. Flink consumes the stream.
4. Data-quality checks are applied.
5. Valid records continue to the main Iceberg table.
6. Invalid or quarantined records are separated.
7. The lineage dashboard reflects the state of the pipeline.
8. Iceberg time-travel can be used to inspect previous data states.

---

## Technology Stack

| Area                  | Technology                                     |
| --------------------- | ---------------------------------------------- |
| Streaming             | Apache Kafka                                   |
| Stream Processing     | Apache Flink                                   |
| Lakehouse Storage     | Apache Iceberg                                 |
| Data Quality          | Python / Data Quality Rules                    |
| Frontend              | React                                          |
| Lineage Visualization | React Flow                                     |
| Language              | Python, JavaScript/TypeScript where applicable |
| Containerization      | Docker                                         |

---

## Project Structure

```text
IceStream/
│
├── src/              # Core project and processing logic
├── frontend/         # Lineage and observability interface
├── tests/            # Test cases
├── data/             # Sample / generated data
├── storage/          # Local storage and lakehouse-related files
├── docs/             # Project documentation
│
├── docker-compose.yml
├── requirements.txt
├── README.md
└── .gitignore
```

The structure may evolve as the project is developed.

---

## Key Objectives

* Process streaming data in near real time.
* Detect data-quality problems during processing.
* Prevent bad data from reaching the main analytical layer.
* Maintain a clear view of data movement through the pipeline.
* Demonstrate lakehouse storage using Apache Iceberg.
* Demonstrate automated handling of data-quality failures.
* Use time-travel capabilities to inspect previous data states.

---

## Testing

Testing will focus on the behavior of the pipeline rather than only checking whether individual components start successfully.

Important scenarios include:

* normal transaction flow
* NULL values
* schema changes
* high error rates
* circuit-breaker activation
* DLQ routing
* recovery after an incident
* Iceberg snapshot/time-travel checks
* frontend pipeline status

Test results and issues will be documented as the project progresses.

---

## Development Plan

### Week 1

* Build the transaction generator.
* Generate realistic streaming transaction data.
* Introduce controlled data-quality issues.
* Set up the initial lineage dashboard.

### Week 2

* Configure the Iceberg lakehouse foundation.
* Connect Kafka with Flink.
* Process the streaming data.
* Add initial data-quality rules.

### Week 3

* Implement the circuit-breaker logic.
* Add DLQ/quarantine handling.
* Connect pipeline status with the frontend.
* Add live monitoring/alerts.

### Week 4

* Implement Iceberg time-travel demonstrations.
* Add incident history/logging.
* Test the complete pipeline.
* Fix remaining issues.
* Finalize documentation and presentation.

---

## Expected Outcome

The final system should demonstrate a self-monitoring streaming pipeline where data-quality problems are detected early and handled before they affect the main analytical dataset.

The project is intended as a practical demonstration of:

**Kafka + Flink + Apache Iceberg + Data Quality + Observability + Automated Remediation**

---

## Status

**Under Development**

The project is being developed incrementally, with implementation, testing, documentation, and GitHub progress maintained throughout the four-week development cycle.

---

## Author

**KOMAL RATHORE**

Real-Time Data Engineering & Lakehouse Observability Project
