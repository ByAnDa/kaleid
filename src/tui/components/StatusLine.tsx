import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

export function StatusLine({ status }: { status: string }): React.ReactElement {
  return (
    <Box>
      <Text color="yellow">
        <Spinner type="dots" /> {status}
      </Text>
    </Box>
  );
}
