import React from 'react';
import Layout from '../../components/shared/Layout';
import IntegrityTransactionsView from '../../components/shared/IntegrityTransactionsView';

export default function GatewayIntegrityTransactions() {
  return (
    <Layout>
      <IntegrityTransactionsView role="gateway_admin" />
    </Layout>
  );
}
