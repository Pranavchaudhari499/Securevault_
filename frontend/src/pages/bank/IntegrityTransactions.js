import React from 'react';
import Layout from '../../components/shared/Layout';
import IntegrityTransactionsView from '../../components/shared/IntegrityTransactionsView';

export default function BankIntegrityTransactions() {
  return (
    <Layout>
      <IntegrityTransactionsView role="bank_officer" />
    </Layout>
  );
}
