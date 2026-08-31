using Xunit;

// Env-var-driven database isolation is process-global: keep test classes sequential.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
