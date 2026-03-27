import React from 'react';
import Layout from '../../components/shared/Layout';
import IntegrityTransactionsView from '../../components/shared/IntegrityTransactionsView';

export default function UserIntegrityTransactions() {
  return (
    <Layout>
      <IntegrityTransactionsView role="user" />
    </Layout>
  );
}
